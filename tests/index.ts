import { UserIO } from '../src/io';

const io = new UserIO(process.stdin, process.stdout);
const run = async () => {
  io.prepare();

  return new Promise((resolve) => {
    io.on('key', (k) => {
      console.log('key', k);
      if (k.ctrl && k.name === 'c') {
        resolve(k);
      }
    });
    io.on('mouse', (k) => {
      console.log('mouse', k);
    });
  });
};

run().catch(console.error).finally(terminate);

async function terminate() {
  io.returnDefault();
  console.log('termination...');
  process.exit(0);
}
process.on('SIGINT', terminate); // CTRL+C
process.on('SIGQUIT', terminate); // Keyboard quit
process.on('SIGTERM', terminate); // `kill` command
