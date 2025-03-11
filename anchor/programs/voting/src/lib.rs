#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

// poll validation error 
#[error_code]
pub enum PollError {
    #[msg("Poll end time must be in the future")]
    InvalidPollEndTime,
    #[msg("Invalid Unix timestamp")]
    InvalidTimestamp,
}

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(ctx: Context<InitializePoll>, 
                            poll_id: u64,
                            description: String,
                            poll_start: u64,
                            poll_end: u64) -> Result<()> {
        //current time
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;

        //validate timestamp
        require!(poll_end > 0, PollError::InvalidTimestamp);

        // poll end time validate
        require!(poll_end > current_time, PollError::InvalidPollEndTime);

        let poll = &mut ctx.accounts.poll;
        poll.poll_id = poll_id;
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;
        poll.total_votes = 0; // Initialize total votes
        Ok(())
    }

    pub fn initialize_candidate(ctx: Context<InitializeCandidate>, 
                                candidate_name: String,
                                _poll_id: u64) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate;
        let poll = &mut ctx.accounts.poll;

        candidate.candidate_name = candidate_name;
        candidate.candidate_votes = 0;

        poll.candidate_amount += 1; // Increment candidate count in poll

        msg!("Candidate '{}' added to poll ID {}.", candidate.candidate_name, poll.poll_id);
        msg!("Total candidates: {}", poll.candidate_amount);
        
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _candidate_name: String, _poll_id: u64) -> Result<()> {
        let vote_record = &mut ctx.accounts.vote_record;
        
        // Check if the voter has already voted
        require!(!vote_record.has_voted, CustomError::AlreadyVoted);

        // Initialize the vote record if it's new
        if vote_record.voter == Pubkey::default() {
            vote_record.voter = ctx.accounts.signer.key();
            vote_record.poll_id = _poll_id;
        }

        // Mark that the voter has voted
        vote_record.has_voted = true;

        // Increment the candidate's vote count
        let candidate = &mut ctx.accounts.candidate;

        let poll = &ctx.accounts.poll;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;

        require!(
            current_time >= poll.poll_start,
            VotingError::PollNotStarted
        );
        require!(
            current_time <= poll.poll_end,
            VotingError::PollEnded
        );


        let poll = &mut ctx.accounts.poll;

        candidate.candidate_votes += 1;
        poll.total_votes += 1; // Increment total votes for the poll

        msg!("Voted for candidate: {}", candidate.candidate_name);
        msg!("Candidate Votes: {}", candidate.candidate_votes);
        msg!("Total Votes in Poll: {}", poll.total_votes);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
        bump
    )]
    pub candidate: Account<'info, Candidate>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote_record", poll_id.to_le_bytes().as_ref(), signer.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(
      init,
      payer = signer,
      space = 8 + Candidate::INIT_SPACE,
      seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
      bump
    )]
    pub candidate: Account<'info, Candidate>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Candidate {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
      init,
      payer = signer,
      space = 8 + Poll::INIT_SPACE,
      seeds = [poll_id.to_le_bytes().as_ref()],
      bump
    )]
    pub poll: Account<'info, Poll>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    #[max_len(200)]
    pub description: String,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
    pub total_votes: u64, // Track total votes for the poll
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub poll_id: u64,
    pub has_voted: bool,
}

#[error_code]
pub enum CustomError {
    #[msg("Voter has already cast a vote in this poll")]
    AlreadyVoted,
}

#[error_code]
pub enum VotingError {
    #[msg("Poll has not started yet")]
    PollNotStarted,
    #[msg("Poll has already ended")]
    PollEnded,
}
