import { ActiveTable } from '../src/active-table';

const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd';

const run = async () => {
  const response = await fetch(url);
  const data = await response.json();
  console.log(
    await new ActiveTable([
      {
        data,
        fields: [
          'name',
          'symbol',
          'price_change_24h',
          'total_supply',
          'max_supply',
          'atl',
        ],
        sortBy: [{ key: 'price_change_24h', direction: 'DESC' }],
        title: 'currencies',
      },
    ]).handle()
  );
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
