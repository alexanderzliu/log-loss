// Holder count fetchers for various blockchain explorers.
// Requires optional API keys via environment variables:
//   ETHERSCAN_API_KEY — for EVM chains (Ethereum, Base, BSC, Arbitrum, etc.)
//   HELIUS_API_KEY    — for Solana

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

const evmExplorerUrls: Record<string, string> = {
  ethereum: 'https://api.etherscan.io',
  base: 'https://api.basescan.org',
  bsc: 'https://api.bscscan.com',
  arbitrum: 'https://api.arbiscan.io',
  optimism: 'https://api-optimistic.etherscan.io',
  polygon: 'https://api.polygonscan.com',
  avalanche: 'https://api.snowscan.xyz',
};

async function fetchEVMHolderCount(chain: string, contractAddress: string): Promise<number | null> {
  if (!ETHERSCAN_API_KEY) return null;

  const baseUrl = evmExplorerUrls[chain];
  if (!baseUrl) return null;

  try {
    const url = `${baseUrl}/api?module=token&action=tokenholdercount&contractaddress=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as { status: string; result: string };
    if (data.status !== '1') return null;

    const count = parseInt(data.result, 10);
    return isNaN(count) ? null : count;
  } catch (error) {
    console.error(`Etherscan holder count error for ${chain}/${contractAddress}:`, error);
    return null;
  }
}

async function fetchSolanaHolderCount(contractAddress: string): Promise<number | null> {
  if (!HELIUS_API_KEY) return null;
  return fetchSolanaHolderCountViaRpc(contractAddress);
}

async function fetchSolanaHolderCountViaRpc(contractAddress: string): Promise<number | null> {
  if (!HELIUS_API_KEY) return null;

  try {
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccounts',
        params: { mint: contractAddress, limit: 1, page: 1 },
      }),
    });
    if (!response.ok) return null;

    const data = await response.json() as { result?: { total?: number } };
    return data.result?.total ?? null;
  } catch (error) {
    console.error(`Helius RPC holder count error for ${contractAddress}:`, error);
    return null;
  }
}

export async function fetchHolderCount(chain: string | null, contractAddress: string | null): Promise<number | null> {
  if (!chain || !contractAddress) return null;

  if (chain === 'solana') {
    return fetchSolanaHolderCount(contractAddress);
  }

  return fetchEVMHolderCount(chain, contractAddress);
}
