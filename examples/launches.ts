import { ActiveTable } from '../src/active-table';

const url = 'https://api.spacexdata.com/v5/launches';

const run = async () => {
  const response = await fetch(url);
  const data = await response.json();
  console.log(
    await new ActiveTable([
      {
        data,
        fields: ['name', 'date_local'],
        sortBy: [{ key: 'date_local', direction: 'DESC' }],
        title: 'Spacex Launches',
      },
    ]).handle()
  );
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
