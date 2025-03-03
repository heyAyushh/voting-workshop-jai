'use client'

import { getVotingProgram, getVotingProgramId } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, SystemProgram } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'
import { BN } from '@coral-xyz/anchor'

export function useVotingProgram() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getVotingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getVotingProgram(provider, programId), [provider, programId])

  const accounts = useQuery({
    queryKey: ['voting', 'all', { cluster }],
    queryFn: () => program.account.poll.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initialize = useMutation({
    mutationKey: ['voting', 'initialize', { cluster }],
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected')

      const pollId = new BN(Date.now());
      const description = "New Poll";
      const pollStart = new BN(Math.floor(Date.now() / 1000));
      const pollEnd = new BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(pollId.toArray('le', 8))],
        program.programId
      );

      return program.methods
        .initializePoll(
          pollId,
          description,
          pollStart,
          pollEnd
        )
        .accounts({
          signer: publicKey,
          poll: pollPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return accounts.refetch()
    },
    onError: (error) => {
      console.error('Failed to initialize poll:', error)
      toast.error('Failed to initialize poll')
    },
  })

  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    initialize,
  }
}

export function useVotingProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const { program } = useVotingProgram()

  const accountQuery = useQuery({
    queryKey: ['voting', 'fetch', { cluster, account }],
    queryFn: () => program.account.poll.fetch(account),
  })

  return {
    accountQuery,
  }
}
