'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { WalletButton } from '../solana/solana-provider'
import { AppHero, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useVotingProgram, useVotingProgramAccount } from './voting-data-access'

export function VotingCreate() {
  const { initialize } = useVotingProgram()

  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => initialize.mutateAsync()}
      disabled={initialize.isPending}
    >
      Create Poll {initialize.isPending && '...'}
    </button>
  )
}

export function VotingList() {
  const { accounts, getProgramAccount } = useVotingProgram()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      {accounts.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : accounts.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts.data?.map((account) => (
            <PollCard key={account.publicKey.toString()} account={account.publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No polls</h2>
          No polls found. Create one above to get started.
        </div>
      )}
    </div>
  )
}

function PollCard({ account }: { account: PublicKey }) {
  const { accountQuery } = useVotingProgramAccount({ account })

  if (accountQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  const poll = accountQuery.data
  if (!poll) return null

  return (
    <div className="card card-bordered border-base-300 border-4">
      <div className="card-body">
        <h2 className="card-title">{poll.description}</h2>
        <p>Poll ID: {poll.pollId.toString()}</p>
        <p>Start: {new Date(poll.pollStart.toNumber() * 1000).toLocaleString()}</p>
        <p>End: {new Date(poll.pollEnd.toNumber() * 1000).toLocaleString()}</p>
        <p>Number of Candidates: {poll.candidateAmount.toString()}</p>
      </div>
    </div>
  )
}
