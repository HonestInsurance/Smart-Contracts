/**
 * @description Test script to verify the Internal Access Interface contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const abiIntAccI = artifacts.require("./IntAccessI.sol");

contract('IntAccessI', async (accounts) => {
    // describe("Function: exit", () => {
    //      ...
    // });

    // variable to store the internal access interface instance in
    let intAccI;

    // Function to verify all the variables within the Internal Access Interface contract
    async function verifyIntAccIntVariables(contractAdr) {
        expect(contractAdr).to.be.eql(await intAccI.getContractAdr());
    }

    it("should deploy a new IntAccessI contract and verify initialization variables", async () => {
        // Deploy a new contract of IntAccessI and specify account[0] as the initial key to be added as the Deployment Controller address
        intAccI = await abiIntAccI.new(accounts[0]);
        // Verify init variables
        await verifyIntAccIntVariables([accounts[0], 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]);
    });    

    it("should set and verify the remaining IntAccessI contract addresses", async () => {
        // Set the remaining keys
        await intAccI.setContractAdr(accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], {from: accounts[0]});
        // Verify all the keys
        await verifyIntAccIntVariables([accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8]]);
    });
});