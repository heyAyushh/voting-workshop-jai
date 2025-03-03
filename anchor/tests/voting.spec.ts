import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Voting } from "../target/types/voting";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(
      IDL,
      provider,
    );
  });

  it("fails to initialize a poll with past poll_end", async () => {
    const pastPollEnd = new anchor.BN(Math.floor(Date.now() / 1000) - 10); // 10 seconds in the past

    await expect(votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "Invalid Poll",
      new anchor.BN(Math.floor(Date.now() / 1000)), // Current timestamp
      pastPollEnd, // Invalid poll_end
    ).rpc()).rejects.toThrow("Poll end time must be in the future");
  });

  it("initializes a poll with valid future poll_end", async () => {
    const futurePollEnd = new anchor.BN(Math.floor(Date.now() / 1000) + 1000); // 1000 seconds in the future

    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(Math.floor(Date.now() / 1000)), // Current timestamp
      futurePollEnd, // Valid future poll_end
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log(poll);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBeGreaterThan(0);
    expect(poll.pollEnd.toNumber()).toBeGreaterThan(poll.pollStart.toNumber()); // Ensure poll_end is in future
  });
});
