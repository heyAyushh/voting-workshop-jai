#![cfg(test)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::ToAccountInfo;
use solana_program_test::*;
use solana_sdk::{signature::Keypair, signer::Signer, transaction::Transaction};
use voting::*;

#[tokio::test]
async fn test_voting() {
    let program = ProgramTest::new("voting", id(), processor!(voting::entry));
    let mut context = program.start_with_context().await;

    let poll_id = 1;
    let candidate_name = "Alice".to_string();
    let description = "Election for Class President".to_string();
    let poll_start = Clock::get().unwrap().unix_timestamp as u64;
    let poll_end = poll_start + 1000;

    let signer = Keypair::new();

    // 1. Initialize the Poll
    let init_poll_ix = initialize_poll(
        context.accounts.clone(),
        poll_id,
        description.clone(),
        poll_start,
        poll_end,
    )
    .unwrap();

    let mut transaction = Transaction::new_with_payer(&[init_poll_ix], Some(&context.payer.pubkey()));
    transaction.sign(&[&context.payer], context.last_blockhash);
    context.banks_client.process_transaction(transaction).await.unwrap();

    // 2. Add a Candidate
    let init_candidate_ix = initialize_candidate(
        context.accounts.clone(),
        candidate_name.clone(),
        poll_id,
    )
    .unwrap();

    let mut transaction = Transaction::new_with_payer(&[init_candidate_ix], Some(&context.payer.pubkey()));
    transaction.sign(&[&context.payer], context.last_blockhash);
    context.banks_client.process_transaction(transaction).await.unwrap();

    // 3. Cast a Vote (First Attempt - Should Succeed)
    let vote_ix = vote(context.accounts.clone(), candidate_name.clone(), poll_id).unwrap();
    let mut transaction = Transaction::new_with_payer(&[vote_ix], Some(&signer.pubkey()));
    transaction.sign(&[&signer], context.last_blockhash);
    context.banks_client.process_transaction(transaction).await.unwrap();

    // 4. Attempt to Vote Again (Should Fail)
    let duplicate_vote = vote(context.accounts.clone(), candidate_name.clone(), poll_id);
    assert!(duplicate_vote.is_err(), "Voter should not be able to vote twice");

    // 5. Attempt to Vote Outside the Poll Active Period (Should Fail)
    let past_poll_id = 2;
    let past_poll_start = poll_start - 2000;
    let past_poll_end = poll_start - 1000;

    let past_poll_ix = initialize_poll(
        context.accounts.clone(),
        past_poll_id,
        description.clone(),
        past_poll_start,
        past_poll_end,
    )
    .unwrap();

    let mut transaction = Transaction::new_with_payer(&[past_poll_ix], Some(&context.payer.pubkey()));
    transaction.sign(&[&context.payer], context.last_blockhash);
    context.banks_client.process_transaction(transaction).await.unwrap();

    let vote_past_poll = vote(context.accounts.clone(), candidate_name.clone(), past_poll_id);
    assert!(vote_past_poll.is_err(), "Voting in an inactive poll should be rejected");

    // 6. Attempt to Vote for a Non-Existent Candidate (Should Fail)
    let non_existent_candidate = "Bob".to_string();
    let vote_non_existent = vote(context.accounts.clone(), non_existent_candidate.clone(), poll_id);
    assert!(vote_non_existent.is_err(), "Voting for a non-existent candidate should be rejected");

    println!("✅ All test cases passed successfully!");
}
