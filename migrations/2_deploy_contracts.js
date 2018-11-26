/**
 * @description Deployment script and intialisation of the Insurance Pool ecosystem
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

// Load the test data to initialise the deployed contract variables
const td = require("../test/misc/testData.js");
const txFunc = require("../test/misc/txFunc.js");
const abiDecoder = require('abi-decoder');
const miscFunc = require("../test/misc/miscFunc.js");

// Load the artifacts of the contracts that are deployed
const abiLib = artifacts.require("./Lib.sol");
const abiTrust = artifacts.require("./Trust.sol");
const abiPool = artifacts.require("./Pool.sol");
const abiBond = artifacts.require("./Bond.sol");
const abiBank = artifacts.require("./Bank.sol");
const abiPolicy = artifacts.require("./Policy.sol");
const abiSettlement = artifacts.require("./Settlement.sol");
const abiAdjustor = artifacts.require("./Adjustor.sol");
const abiTimer = artifacts.require("./Timer.sol");

// Insurance pool deployment variables
const isWinterTime = false;

// Start deployment of the contracts
module.exports = async (deployer, network, accounts) => {
    deployer.then(async () => {
        // Use the first account for deployment
        const deploymentAccount = accounts[0];

        // Save and copy all the pre-populated Ethereum accounts into the testData accounts
        td.accounts = accounts;

        // Deploy the library contract
        await deployer.deploy(abiLib, {from: deploymentAccount});

        // Linking the library to the contracts that need to be deployed next and depend on it
        await deployer.link(abiLib, abiTrust);
        await deployer.link(abiLib, abiPool);
        await deployer.link(abiLib, abiBond);
        await deployer.link(abiLib, abiBank);
        await deployer.link(abiLib, abiPolicy);
        await deployer.link(abiLib, abiSettlement);
        await deployer.link(abiLib, abiAdjustor);
        await deployer.link(abiLib, abiTimer);

        // Deploy all the remaining contracts
        await deployer.deploy(abiTrust, {from: deploymentAccount});
        await deployer.deploy(abiPool, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiBond, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiBank, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiPolicy, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiSettlement, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiAdjustor, (await abiTrust.deployed()).address, {from: deploymentAccount});
        await deployer.deploy(abiTimer, (await abiTrust.deployed()).address, {from: deploymentAccount});

        // Save the contracts in testdata
        td.pool = await abiPool.deployed();
        td.bond = await abiBond.deployed();
        td.bank = await abiBank.deployed();
        td.policy = await abiPolicy.deployed();
        td.settlement = await abiSettlement.deployed();
        td.adjustor = await abiAdjustor.deployed();
        td.timer = await abiTimer.deployed();
        td.trust = await abiTrust.deployed();

        // Initialise pool ecosystem; Link all contracts together and set next overnight processing timestamp
        var tx = await td.trust.initEcosystem(
            td.pool.address,
            td.bond.address,
            td.bank.address,
            td.policy.address,
            td.settlement.address,
            td.adjustor.address,
            td.timer.address,
            isWinterTime,
            {from: deploymentAccount}
        );

        // Perform these steps only for development network to enable testing procedures to execute
        if (network == "development") {
            // Save all the event log files to the abi decoder object
            td.abiDecoder = abiDecoder;
            td.abiDecoder.addABI(td.trust.abi);
            td.abiDecoder.addABI(td.pool.abi);
            td.abiDecoder.addABI(td.bond.abi);
            td.abiDecoder.addABI(td.bank.abi);
            td.abiDecoder.addABI(td.policy.abi);
            td.abiDecoder.addABI(td.settlement.abi);
            td.abiDecoder.addABI(td.adjustor.abi);

            // Save the current day
            td.currentPoolDay = (await td.pool.currentPoolDay()).toNumber();
            // Save the initial overnight processing timestamp
            td.nextOvernightProcessingTimestamp = td.abiDecoder.decodeLogs(tx.receipt.rawLogs)[8].events[2].value;
        }        
        
        
        // Print deployment summary
        console.log("");
        console.log("***************************************************************************");
        console.log("*                                                                         *");
        console.log("*  DEPLOYMENT SUMMARY                               " + miscFunc.getLocalDateStringFromEpoch(td.abiDecoder.decodeLogs(tx.receipt.rawLogs)[0].events[3].value) + "   *");
        console.log("*                                                                         *");
        console.log("***************************************************************************");
        console.log("*                                                                         *");
        console.log("*    Deployment network:     " + network);
        console.log("*    Deployment address:     " + deploymentAccount + "   *");
        console.log("*-------------------------------------------------------------------------*");
        console.log("*    Library address:        " + (await abiLib.deployed()).address + "   *");
        console.log("*-------------------------------------------------------------------------*");
        console.log("*    TrustContractAdr:       " + td.trust.address + "   *");
        console.log("*    PoolContractAdr:        " + td.pool.address + "   *");
        console.log("*    BondContractAdr:        " + td.bond.address + "   *");
        console.log("*    BankContractAdr:        " + td.bank.address + "   *");
        console.log("*    PolicyContractAdr:      " + td.policy.address + "   *");
        console.log("*    SettlementContractAdr:  " + td.settlement.address + "   *");
        console.log("*    AdjustorContractAdr:    " + td.adjustor.address + "   *");
        console.log("*    TimerContractAdr:       " + td.timer.address + "   *");
        console.log("***************************************************************************");
        console.log("");
    });
};