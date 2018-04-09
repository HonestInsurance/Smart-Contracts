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
        // Save and copy all the pre-populated Ethereum accounts into the testData accounts!
        td.accounts = accounts;

        // Deploy the library contract
        await deployer.deploy(abiLib);

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
        await deployer.deploy(abiTrust);
        await deployer.deploy(abiPool, (await abiTrust.deployed()).address);
        await deployer.deploy(abiBond, (await abiTrust.deployed()).address);
        await deployer.deploy(abiBank, (await abiTrust.deployed()).address);
        await deployer.deploy(abiPolicy, (await abiTrust.deployed()).address);
        await deployer.deploy(abiSettlement, (await abiTrust.deployed()).address);
        await deployer.deploy(abiAdjustor, (await abiTrust.deployed()).address);
        await deployer.deploy(abiTimer, (await abiTrust.deployed()).address);

        // Save the contracts in testdata
        td.pool = await abiPool.deployed();
        td.bond = await abiBond.deployed();
        td.bank = await abiBank.deployed();
        td.policy = await abiPolicy.deployed();
        td.settlement = await abiSettlement.deployed();
        td.adjustor = await abiAdjustor.deployed();
        td.timer = await abiTimer.deployed();
        td.trust = await abiTrust.deployed();

        // All all the event log files to the abi decoder object
        td.abiDecoder = abiDecoder;
        td.abiDecoder.addABI(td.trust.abi);
        td.abiDecoder.addABI(td.pool.abi);
        td.abiDecoder.addABI(td.bond.abi);
        td.abiDecoder.addABI(td.bank.abi);
        td.abiDecoder.addABI(td.policy.abi);
        td.abiDecoder.addABI(td.settlement.abi);
        td.abiDecoder.addABI(td.adjustor.abi);

        // Initialise pool ecosystem; Link all contracts together and set next overnight processing timestamp
        await td.trust.initEcosystem(
            td.pool.address,
            td.bond.address,
            td.bank.address,
            td.policy.address,
            td.settlement.address,
            td.adjustor.address,
            td.timer.address,
            isWinterTime
        );

        // Save the current day
        td.currentPoolDay = (await td.pool.currentPoolDay()).valueOf();
        // Save the initial overnight processing timestamp
        td.nextOvernightProcessingTimestamp = parseInt((await txFunc.getEventsPromise(td.pool.LogPool({ subject: 'SetInitialProcessingTime' }, { fromBlock: 0, toBlock: "latest" })))[0].args.value);

            
        // Print all the references for POSTMAN copy past
        console.log("");
        console.log("");
        console.log("Copy and paste the blow content into POSTMAN");
        console.log("--------------------------------------------");
        // console.log("url:http://localhost:5000");
        console.log("TrustContractAdr:" + td.trust.address);
        console.log("PoolContractAdr:" + td.pool.address);
        console.log("BondContractAdr:" + td.bond.address);
        console.log("BankContractAdr:" + td.bank.address);
        console.log("PolicyContractAdr:" + td.policy.address);
        console.log("SettlementContractAdr:" + td.settlement.address);
        console.log("AdjustorContractAdr:" + td.adjustor.address);
        console.log("TimerContractAdr:" + td.timer.address);
        console.log("");
    });
};