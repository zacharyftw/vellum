use starknet::ContractAddress;

/// Must match `privacy::objects::OpenNoteDeposit` (positional Serde).
///
/// The pool deserialises whatever `privacy_invoke` returns into a
/// `Span<OpenNoteDeposit>`. This registry always returns an empty span — it
/// moves no tokens — but the type still has to line up for deserialisation to
/// succeed.
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

/// A single invoice's on-chain footprint.
///
/// Four felts, and not one of them is readable. `commitment` is a salted
/// Poseidon hash of the invoice terms; `payment_commitment` additionally binds
/// the payer. Amounts, parties, and line items live nowhere near this contract.
#[derive(Drop, Serde, Copy, PartialEq, Debug, starknet::Store)]
pub struct InvoiceAnchor {
    /// Poseidon commitment to the invoice terms. Zero means never anchored.
    pub commitment: felt252,
    /// Block timestamp the commitment was fixed at.
    pub anchored_at: u64,
    /// Commitment binding the settlement to the payer. Zero until paid.
    pub payment_commitment: felt252,
    /// Block timestamp of settlement. Zero until paid.
    pub paid_at: u64,
}

#[starknet::interface]
pub trait IInvoiceRegistry<TState> {
    /// Fix an invoice's commitment ahead of payment.
    ///
    /// Optional. Anchoring early proves the terms existed before settlement —
    /// which matters in a dispute, or when factoring the receivable — but it is
    /// a public transaction from the issuer's account, so it links that account
    /// to an invoice id. Suppliers who care more about unlinkability than about
    /// a pre-payment timestamp should skip this and let settlement anchor both
    /// commitments at once.
    fn anchor_invoice(ref self: TState, invoice_id: felt252, commitment: felt252);

    /// Called by the privacy pool via `selector!("privacy_invoke")`, inside the
    /// buyer's private transaction.
    ///
    /// Marks the invoice settled. If it was never anchored, this also fixes the
    /// invoice commitment, so the whole record can be created without the
    /// issuer ever touching the chain publicly.
    ///
    /// Returns an empty span: no tokens are handled here, so no open note is
    /// filled. The money moved in the `transfer` action that shares this
    /// transaction.
    fn privacy_invoke(
        ref self: TState,
        invoice_id: felt252,
        payment_commitment: felt252,
        pool_address: ContractAddress,
    ) -> Span<OpenNoteDeposit>;

    fn get_invoice(self: @TState, invoice_id: felt252) -> InvoiceAnchor;
    fn is_paid(self: @TState, invoice_id: felt252) -> bool;
    fn get_pool(self: @TState) -> ContractAddress;
}

#[starknet::contract]
pub mod InvoiceRegistry {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use super::{InvoiceAnchor, OpenNoteDeposit};

    pub mod errors {
        pub const NOT_POOL: felt252 = 'NOT_POOL';
        pub const POOL_MISMATCH: felt252 = 'POOL_MISMATCH';
        pub const ZERO_POOL: felt252 = 'ZERO_POOL';
        pub const ZERO_INVOICE_ID: felt252 = 'ZERO_INVOICE_ID';
        pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
        pub const ALREADY_ANCHORED: felt252 = 'ALREADY_ANCHORED';
        pub const ALREADY_PAID: felt252 = 'ALREADY_PAID';
    }

    #[storage]
    struct Storage {
        /// The privacy pool permitted to settle invoices. Immutable after deploy.
        pool_address: ContractAddress,
        invoices: Map<felt252, InvoiceAnchor>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        InvoiceAnchored: InvoiceAnchored,
        InvoiceSettled: InvoiceSettled,
    }

    /// Emitted when a commitment is first fixed, whether by the issuer ahead of
    /// time or by settlement itself.
    #[derive(Drop, starknet::Event)]
    pub struct InvoiceAnchored {
        #[key]
        pub invoice_id: felt252,
        pub commitment: felt252,
        pub anchored_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InvoiceSettled {
        #[key]
        pub invoice_id: felt252,
        pub payment_commitment: felt252,
        pub paid_at: u64,
    }

    /// `pool` is the STRK20 privacy pool address, and it is the only account
    /// that will ever be allowed to settle an invoice here.
    #[constructor]
    fn constructor(ref self: ContractState, pool: ContractAddress) {
        assert(pool.is_non_zero(), errors::ZERO_POOL);
        self.pool_address.write(pool);
    }

    #[abi(embed_v0)]
    impl InvoiceRegistryImpl of super::IInvoiceRegistry<ContractState> {
        fn anchor_invoice(
            ref self: ContractState, invoice_id: felt252, commitment: felt252,
        ) {
            assert(invoice_id != 0, errors::ZERO_INVOICE_ID);
            assert(commitment != 0, errors::ZERO_COMMITMENT);

            let entry = self.invoices.entry(invoice_id);
            // A commitment that could be rewritten would prove nothing — the
            // whole claim this contract makes is that the terms were fixed at a
            // known time and never moved.
            assert(entry.read().commitment == 0, errors::ALREADY_ANCHORED);

            let anchored_at = get_block_timestamp();
            entry
                .write(
                    InvoiceAnchor {
                        commitment, anchored_at, payment_commitment: 0, paid_at: 0,
                    },
                );
            self.emit(InvoiceAnchored { invoice_id, commitment, anchored_at });
        }

        fn privacy_invoke(
            ref self: ContractState,
            invoice_id: felt252,
            payment_commitment: felt252,
            pool_address: ContractAddress,
        ) -> Span<OpenNoteDeposit> {
            let pool = self.pool_address.read();

            // The caller check is what actually secures this. Comparing the
            // `${poolAddress}` argument against the caller alone would be
            // worthless — a direct caller controls both sides of that equality
            // and could mark any invoice paid. Both are checked against the
            // address fixed at deployment instead.
            assert(get_caller_address() == pool, errors::NOT_POOL);
            assert(pool_address == pool, errors::POOL_MISMATCH);

            assert(invoice_id != 0, errors::ZERO_INVOICE_ID);
            assert(payment_commitment != 0, errors::ZERO_COMMITMENT);

            let entry = self.invoices.entry(invoice_id);
            let anchor = entry.read();
            // Presence is tested on `payment_commitment`, never on `paid_at`.
            // A timestamp doubling as a flag conflates "unpaid" with "paid in a
            // block whose timestamp was zero", and the commitment is asserted
            // non-zero just below — so it is the honest sentinel.
            assert(anchor.payment_commitment == 0, errors::ALREADY_PAID);

            let paid_at = get_block_timestamp();

            // Settling an invoice that was never anchored fixes both
            // commitments together, so an issuer who never wants to appear
            // on-chain still ends up with a provable record.
            let commitment = if anchor.commitment == 0 {
                self
                    .emit(
                        InvoiceAnchored {
                            invoice_id, commitment: payment_commitment, anchored_at: paid_at,
                        },
                    );
                payment_commitment
            } else {
                anchor.commitment
            };
            let anchored_at = if anchor.commitment == 0 {
                paid_at
            } else {
                anchor.anchored_at
            };

            entry
                .write(InvoiceAnchor { commitment, anchored_at, payment_commitment, paid_at });
            self.emit(InvoiceSettled { invoice_id, payment_commitment, paid_at });

            // No tokens handled, so no open note to fill. The pool accepts an
            // empty span and applies no deposits.
            let no_deposits: Array<OpenNoteDeposit> = array![];
            no_deposits.span()
        }

        fn get_invoice(self: @ContractState, invoice_id: felt252) -> InvoiceAnchor {
            self.invoices.entry(invoice_id).read()
        }

        fn is_paid(self: @ContractState, invoice_id: felt252) -> bool {
            self.invoices.entry(invoice_id).read().payment_commitment != 0
        }

        fn get_pool(self: @ContractState) -> ContractAddress {
            self.pool_address.read()
        }
    }
}
