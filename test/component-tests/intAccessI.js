/**
 * @description Test script to verify the Internal Access Interface contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const abiIntAccI = artifacts.require("./IntAccessI.sol");
const miscFunc = require("../misc/miscFunc.js");

contract('IntAccessI', async (accounts) => {
    // variable to store the internal access interface instance in
    let intAccI;
    // variable to store empty address in
    const emptyAdr = miscFunc.getEmptyAdr();


    // Function to verify all the variables within the Internal Access Interface contract
    async function verifyIntAccIntVariables(contractAdr) {
        // Get the stored addresses of the contracts
        const intAdr = await intAccI.getContractAdr();
        // Verify the contract addresses
        expect(contractAdr[0]).to.be.equal(intAdr.trustContractAdr);
        expect(contractAdr[1]).to.be.equal(intAdr.poolContractAdr);
        expect(contractAdr[2]).to.be.equal(intAdr.bondContractAdr);
        expect(contractAdr[3]).to.be.equal(intAdr.bankContractAdr);
        expect(contractAdr[4]).to.be.equal(intAdr.policyContractAdr);
        expect(contractAdr[5]).to.be.equal(intAdr.settlementContractAdr);
        expect(contractAdr[6]).to.be.equal(intAdr.adjustorContractAdr);
        expect(contractAdr[7]).to.be.equal(intAdr.timerContractAdr);
    }

    it("should deploy a new IntAccessI contract and verify initialization variables", async () => {
        // Deploy a new contract of IntAccessI and specify account[0] as the initial key to be added as the Deployment Controller address
        intAccI = await abiIntAccI.new(accounts[0]);
        // Verify init variables
        await verifyIntAccIntVariables([accounts[0], emptyAdr, emptyAdr, emptyAdr, emptyAdr, emptyAdr, emptyAdr, emptyAdr]);
    });    

    it("should set and verify the remaining IntAccessI contract addresses", async () => {
        // Set the remaining keys
        await intAccI.setContractAdr(accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], {from: accounts[0]});
        // Verify all the keys
        await verifyIntAccIntVariables([accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8]]);
    });
});