/**
 * @description Truffle configuration settings
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const HDWalletProvider = require('truffle-hdwallet-provider');
const mnemonic = require('./build/mnemonic');

module.exports = {
  networks: {
    // Local development environment (ganache-cli)
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
      },
    
    // Rinkeby
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic.RINKEBY_MNEMONIC, "https://rinkeby.honestinsurance.net/");
      },
      network_id: '4',
    }
  },

  solc: { optimizer: { enabled: true, runs: 200 } }
};