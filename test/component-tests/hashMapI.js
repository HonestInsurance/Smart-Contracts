/**
 * @description Test script to verify the Hash Map Interface contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const abiLib = artifacts.require("./Lib.sol");
const abiHashMapITest = artifacts.require("./HashMapITest.sol");

contract('HashMapI', async (accounts) => {
    // Store the contract instance of hashMapITest
    let hashMapITest;

    // Function verifies an single hash in the mapping specified by the idx
    async function verifySingleHash(hashMapStateArray, idx) {
        // Create the hash at the idx value
        const hashAtIdx = web3.sha3(accounts[idx]);
        // Retrieve the boolean values of this particular hash belonging to this idx is active, archived and valid
        const isHashActive = await hashMapITest.isActive(hashAtIdx);
        const isHashArchived = await hashMapITest.isArchived(hashAtIdx);
        const isHashValid = await hashMapITest.isValid(hashAtIdx);

        if (hashMapStateArray[idx] == 0) {
            expect(isHashActive).to.be(false);
            expect(isHashArchived).to.be(false);
            expect(isHashValid).to.be(false);
        }
        else if (hashMapStateArray[idx] == 1) {
            expect(isHashActive).to.be(true);
            expect(isHashArchived).to.be(false);
            expect(isHashValid).to.be(true);
            expect(hashAtIdx).equal(await hashMapITest.get(idx));
        }
        else if (hashMapStateArray[idx] == 2) {
            expect(isHashActive).to.be(false);
            expect(isHashArchived).to.be(true);
            expect(isHashValid).to.be(true);
            expect(hashAtIdx).equal(await hashMapITest.get(idx));
        }
    }

    // Function to verify the mapping hashes stored and their status
    //    Variable hashMapStateArray is a list with 10 integers in one of the following states
    //        0 ... not part of the mapping
    //        1 ... active hash
    //        2 ... archived hash
    async function verifyHashMappingVariables(hashMapStateArray, firstIdx, nextIdx, count) {
        // Get the hashMap details of first index, next index and count of active entries
        const info = await hashMapITest.hashMap();
        // Check if first, next and count are correct
        expect([firstIdx, nextIdx, count]).to.be.eql(info.map(x => x.valueOf()));

        // Verify the first 10 entries in the hash map
        for (let i=1; i<=10; i++)
            await verifySingleHash(hashMapStateArray, i);
    }

    it("should deploy library and HashMapI contract and verify initialisation variables", async () => {
        // Deploy the library
        await abiLib.new(accounts[0]);
        // Link the library contract
        abiHashMapITest.link(abiLib, abiHashMapITest);
        // Deploy the hash map test contract
        hashMapITest = await abiHashMapITest.new(accounts[0]);
        // Verify the hash map is correctly initialised
        await verifyHashMappingVariables([0,0,0,0,0,0,0,0,0,0,0], 1, 1, 0);
    });

    it("should add hash 1", async () => {
        await hashMapITest.addHash(web3.sha3(accounts[1]));
        await verifyHashMappingVariables([0,1,0,0,0,0,0,0,0,0,0], 1, 2, 1);
    });

    it("should add hash 2", async () => {
        await hashMapITest.addHash(web3.sha3(accounts[2]));
        await verifyHashMappingVariables([0,1,1,0,0,0,0,0,0,0,0], 1, 3, 2);
    });

    it("should add hash 3", async () => {
        await hashMapITest.addHash(web3.sha3(accounts[3]));
        await verifyHashMappingVariables([0,1,1,1,0,0,0,0,0,0,0], 1, 4, 3);
    });

    it("should archive hash 2", async () => {
        await hashMapITest.archiveHash(web3.sha3(accounts[2]));
        await verifyHashMappingVariables([0,1,2,1,0,0,0,0,0,0,0], 1, 4, 2);
    });

    it("should archive hash 1", async () => {
        await hashMapITest.archiveHash(web3.sha3(accounts[1]));
        await verifyHashMappingVariables([0,2,2,1,0,0,0,0,0,0,0], 3, 4, 1);
    });
    
    it("should archive hash 3", async () => {
        await hashMapITest.archiveHash(web3.sha3(accounts[3]));
        await verifyHashMappingVariables([0,2,2,2,0,0,0,0,0,0,0], 4, 4, 0);
    });
});
