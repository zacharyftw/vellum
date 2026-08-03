use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use vellum_invoice_registry::{
    IInvoiceRegistryDispatcher, IInvoiceRegistryDispatcherTrait,
};

/// Stand-in for the STRK20 privacy pool — the only caller allowed to settle.
fn pool() -> ContractAddress {
    0x5210_7fad_ffab_71bd_cbb6_b2cc_b68b_a3e1.try_into().unwrap()
}

/// Anyone who is not the pool.
fn stranger() -> ContractAddress {
    0xdead_beef.try_into().unwrap()
}

const INVOICE_ID: felt252 = 0x9f2b1c4d6e8a0b2c4d6e8a0b2c4d6e8a;
const COMMITMENT: felt252 = 0x71a3c9e5b28d4f60a1b2c3d4e5f60718;
const PAYMENT_COMMITMENT: felt252 = 0x4c8f2e1d0a9b8c7d6e5f4a3b2c1d0e9f;
const ANCHOR_TIME: u64 = 1_760_000_000;
const SETTLE_TIME: u64 = 1_761_000_000;

fn deploy() -> IInvoiceRegistryDispatcher {
    let contract = declare("InvoiceRegistry").unwrap().contract_class();
    let mut calldata = array![];
    pool().serialize(ref calldata);
    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IInvoiceRegistryDispatcher { contract_address }
}

/// Settle as the pool would: caller is the pool, and the substituted
/// `${poolAddress}` argument matches it.
fn settle_as_pool(
    registry: IInvoiceRegistryDispatcher, invoice_id: felt252, payment_commitment: felt252,
) {
    start_cheat_caller_address(registry.contract_address, pool());
    registry.privacy_invoke(invoice_id, payment_commitment, pool());
    stop_cheat_caller_address(registry.contract_address);
}

#[test]
fn constructor_records_the_pool() {
    assert(deploy().get_pool() == pool(), 'pool not stored');
}

#[test]
fn constructor_rejects_zero_pool() {
    // Asserted on the returned error rather than with `should_panic`: a
    // constructor revert comes back inside the deploy `Result`, so `.unwrap()`
    // would panic with "Result::unwrap failed" and the test would pass for a
    // reason that has nothing to do with the pool address.
    let contract = declare("InvoiceRegistry").unwrap().contract_class();
    let zero: ContractAddress = 0.try_into().unwrap();
    let mut calldata = array![];
    zero.serialize(ref calldata);

    match contract.deploy(@calldata) {
        Result::Ok(_) => panic!("a zero pool address should not deploy"),
        Result::Err(reason) => assert(*reason.at(0) == 'ZERO_POOL', 'wrong revert reason'),
    }
}

#[test]
fn anchor_fixes_the_commitment_and_timestamp() {
    let registry = deploy();
    start_cheat_block_timestamp_global(ANCHOR_TIME);

    registry.anchor_invoice(INVOICE_ID, COMMITMENT);

    let anchor = registry.get_invoice(INVOICE_ID);
    assert(anchor.commitment == COMMITMENT, 'wrong commitment');
    assert(anchor.anchored_at == ANCHOR_TIME, 'wrong anchor time');
    assert(anchor.payment_commitment == 0, 'should be unpaid');
    assert(anchor.paid_at == 0, 'should be unpaid');
    assert(!registry.is_paid(INVOICE_ID), 'should not read as paid');
}

#[test]
fn unknown_invoice_reads_as_empty() {
    let registry = deploy();
    let anchor = registry.get_invoice(INVOICE_ID);
    assert(anchor.commitment == 0, 'should be empty');
    assert(!registry.is_paid(INVOICE_ID), 'should not be paid');
}

#[test]
#[should_panic(expected: 'ALREADY_ANCHORED')]
fn anchor_cannot_be_rewritten() {
    // The contract's whole claim is that terms were fixed and never moved. A
    // second anchor would make the commitment a suggestion.
    let registry = deploy();
    registry.anchor_invoice(INVOICE_ID, COMMITMENT);
    registry.anchor_invoice(INVOICE_ID, PAYMENT_COMMITMENT);
}

#[test]
#[should_panic(expected: 'ZERO_INVOICE_ID')]
fn anchor_rejects_zero_id() {
    deploy().anchor_invoice(0, COMMITMENT);
}

#[test]
#[should_panic(expected: 'ZERO_COMMITMENT')]
fn anchor_rejects_zero_commitment() {
    deploy().anchor_invoice(INVOICE_ID, 0);
}

#[test]
fn settlement_marks_an_anchored_invoice_paid() {
    let registry = deploy();
    start_cheat_block_timestamp_global(ANCHOR_TIME);
    registry.anchor_invoice(INVOICE_ID, COMMITMENT);

    start_cheat_block_timestamp_global(SETTLE_TIME);
    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);

    let anchor = registry.get_invoice(INVOICE_ID);
    assert(anchor.commitment == COMMITMENT, 'commitment changed');
    assert(anchor.anchored_at == ANCHOR_TIME, 'anchor time changed');
    assert(anchor.payment_commitment == PAYMENT_COMMITMENT, 'wrong payment commitment');
    assert(anchor.paid_at == SETTLE_TIME, 'wrong paid time');
    assert(registry.is_paid(INVOICE_ID), 'should read as paid');
}

#[test]
fn settlement_returns_no_open_note_deposits() {
    // The pool deserialises this span and applies each entry to an open note.
    // Vellum moves its tokens in the sibling `transfer` action, so returning
    // anything here would be the contract claiming to have funded a note it
    // never touched.
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, pool());
    let deposits = registry.privacy_invoke(INVOICE_ID, PAYMENT_COMMITMENT, pool());
    stop_cheat_caller_address(registry.contract_address);
    assert(deposits.len() == 0, 'expected no deposits');
}

#[test]
fn settlement_anchors_an_invoice_that_was_never_anchored() {
    // An issuer who never wants to appear on-chain publicly still ends up with
    // a provable record: both commitments are fixed by the buyer's payment.
    let registry = deploy();
    start_cheat_block_timestamp_global(SETTLE_TIME);

    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);

    let anchor = registry.get_invoice(INVOICE_ID);
    assert(anchor.commitment == PAYMENT_COMMITMENT, 'commitment not fixed');
    assert(anchor.anchored_at == SETTLE_TIME, 'anchor time not fixed');
    assert(anchor.paid_at == SETTLE_TIME, 'paid time not fixed');
    assert(registry.is_paid(INVOICE_ID), 'should read as paid');
}

#[test]
#[should_panic(expected: 'ALREADY_PAID')]
fn an_invoice_cannot_be_settled_twice() {
    let registry = deploy();
    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);
    settle_as_pool(registry, INVOICE_ID, COMMITMENT);
}

#[test]
#[should_panic(expected: 'NOT_POOL')]
fn a_stranger_cannot_settle() {
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, stranger());
    registry.privacy_invoke(INVOICE_ID, PAYMENT_COMMITMENT, pool());
}

#[test]
#[should_panic(expected: 'NOT_POOL')]
fn a_stranger_cannot_settle_by_naming_themselves_as_the_pool() {
    // The exact hole in the starter kit's demo helper, which asserts only that
    // the `pool_address` argument equals the caller. A direct caller controls
    // both sides of that comparison, so it always passes and any invoice can be
    // marked paid. Authorising against the address fixed at deployment closes it.
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, stranger());
    registry.privacy_invoke(INVOICE_ID, PAYMENT_COMMITMENT, stranger());
}

#[test]
#[should_panic(expected: 'POOL_MISMATCH')]
fn settlement_rejects_a_mismatched_pool_argument() {
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, pool());
    registry.privacy_invoke(INVOICE_ID, PAYMENT_COMMITMENT, stranger());
}

#[test]
#[should_panic(expected: 'ZERO_INVOICE_ID')]
fn settlement_rejects_zero_id() {
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, pool());
    registry.privacy_invoke(0, PAYMENT_COMMITMENT, pool());
}

#[test]
#[should_panic(expected: 'ZERO_COMMITMENT')]
fn settlement_rejects_zero_payment_commitment() {
    let registry = deploy();
    start_cheat_caller_address(registry.contract_address, pool());
    registry.privacy_invoke(INVOICE_ID, 0, pool());
}

#[test]
fn settlement_registers_even_at_block_timestamp_zero() {
    // Regression: `paid_at` and `anchored_at` are timestamps, and an earlier
    // version used `paid_at != 0` as the "is this paid?" test. That made an
    // invoice settled in a zero-timestamp block read as unpaid forever — and,
    // worse, let it be settled a second time. Presence is tested on the
    // commitments now, which are asserted non-zero on the way in.
    let registry = deploy();
    start_cheat_block_timestamp_global(0);

    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);

    assert(registry.is_paid(INVOICE_ID), 'should be paid at t=0');
    let anchor = registry.get_invoice(INVOICE_ID);
    assert(anchor.payment_commitment == PAYMENT_COMMITMENT, 'commitment not stored');
    assert(anchor.paid_at == 0, 'timestamp should be zero');
}

#[test]
#[should_panic(expected: 'ALREADY_PAID')]
fn settlement_at_timestamp_zero_still_cannot_repeat() {
    let registry = deploy();
    start_cheat_block_timestamp_global(0);
    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);
    settle_as_pool(registry, INVOICE_ID, COMMITMENT);
}

#[test]
fn invoices_are_independent() {
    let registry = deploy();
    let other_id: felt252 = 0x1234_5678;

    registry.anchor_invoice(INVOICE_ID, COMMITMENT);
    settle_as_pool(registry, INVOICE_ID, PAYMENT_COMMITMENT);

    assert(registry.is_paid(INVOICE_ID), 'first should be paid');
    assert(!registry.is_paid(other_id), 'second should be unpaid');
    assert(registry.get_invoice(other_id).commitment == 0, 'second should be empty');
}
