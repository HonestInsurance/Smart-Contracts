/**
 * @description Execution of unit tests to verify the entire Insurance Pool model
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

// Load the java script files to access their functions
const miscFunc = require("./misc/miscFunc.js");
const setupI = require("./misc/setupI.js");
const td = require("./misc/testData.js");
const printLogs = require("./misc/printLogs.js");
const utAdjustor = require("./unit-tests/adjustor.js");
const utSettlement = require("./unit-tests/settlement.js");
const utPool = require("./unit-tests/pool.js");
const utTrust = require("./unit-tests/trust.js");
const utBank = require("./unit-tests/bank.js");
const utBond = require("./unit-tests/bond.js");
const utPolicy = require("./unit-tests/policy.js");


contract('All Insurance Ecosystem Contracts', async (accounts) => {

    // Function combines all overnight processing tasks and calls the required unit test
    async function overnightProcessing(_wcExpensesPerDay) {
        await utPool.setWcExpenses(_wcExpensesPerDay);
        // await utPool.dailyOvernightProcessing();
        // await utPool.dailyPolicyProcessing();
        // await utBank.processAllOutstandginPaymentAdvice();
    }

    // Function combines bond creation and principal deposit
    async function createBondCreditPrincipal(_principal_cu, _bondRefHash, bIdx, bOwnerIdx) {
        await utBond.createBond(_principal_cu, _bondRefHash, bOwnerIdx);
        await utBank.bondPrincipalCredit(td.bHash[bIdx]);
    }

    // Function combines policy creation and credit of the policy premium
    async function createPolicyCreditPremium(_riskPoints, pIdx, aIdx, _premiumAmount_cu) {
        await utPolicy.createPolicy(_riskPoints, pIdx, aIdx)
        await utBank.policyPremiumCredit(td.pHash[pIdx], _premiumAmount_cu);
    }

    // ******************************************************************************
    // *** Verify the ecosystem has been initialised correclty and save test data
    // ******************************************************************************

    it("should verify and save the initialization variables.                                                            ", async () => {
        await utTrust.verifyDeployedContracts();
    });

    // ******************************************************************************
    // *** Test ADJUSTORS
    // ******************************************************************************

    it("should create adjustor 1 [owner: 1]                                                                             ", async () => {
        const aIdx = 1;
        await utAdjustor.createAdjustor(td.accounts[aIdx], 25000000, 2000, miscFunc.getRandomHash());
    });

    it("should create adjustor 2 [owner: 2]                                                                             ", async () => {
        const aIdx = 2;
        await utAdjustor.createAdjustor(td.accounts[aIdx], 45000000, 1500, miscFunc.getRandomHash());
    });

    it("should create adjustor 3 [owner: 3]                                                                             ", async () => {
        const aIdx = 3;
        await utAdjustor.createAdjustor(td.accounts[aIdx], 55000000, 0, miscFunc.getRandomHash());
    });

    it("should create adjustor 4 [owner: 4]                                                                             ", async () => {
        const aIdx = 4;
        await utAdjustor.createAdjustor(td.accounts[aIdx], 0, 5000, miscFunc.getRandomHash());
    });

    it("should update adjustor 4 [owner: 4]                                                                             ", async () => {
        const aIdx = 4;
        await utAdjustor.updateAdjustor(td.aHash[aIdx] , td.accounts[aIdx], 35000000, 0, miscFunc.getRandomHash());
    });

    it("should retire adjustor 4 [owner: 4]                                                                             ", async () => {
        const aIdx = 4;
        await utAdjustor.retireAdjustor(td.aHash[aIdx]);
    });

    // ******************************************************************************
    // *** Test POOL, BOND, POLICY, BANK
    // ******************************************************************************

    it("should run all overnight processing tasks                                                                       ", async () => {
        await overnightProcessing(100000);
    });

    // it("should change the pool daylight saving time                                                                     ", async () => {
    //     await utTrust.adjustDaylightSaving();
    // });

    // it("should create bond 1 [owner: 1] (SecuredBondPrincipal)                                                          ", async () => {
    //     const bOwnerIdx = 1;
    //     await utBond.createBond(25000, 0x0, bOwnerIdx);
    // });

    // it("should credit bond 1 [owner: 1] principal amount to Funding account (SecuredBondPrincipal)                      ", async () => {
    //     const bIdx = 1;
    //     await utBank.bondPrincipalCredit(td.bHash[bIdx]);
    // });

    // it("should accelerate the Pool Yield by 48 intervals (2 days)                                                       ", async () => {
    //     await utPool.acceleratePoolYield(48);  
    // });

    // it("should create bond 2 [owner: 2] (SecuredBondPrincipal) and credit principal amount to Funding account           ", async () => {
    //     const bIdx = 2; const refBondIdx = null; const bOwnerIdx = 1;
    //     await createBondCreditPrincipal(7000000, 0x0, bIdx, bOwnerIdx);
    // });

    // it("should create policy 1 [owner: 1], adjustor 1                                                                   ", async () => {
    //     const pIdx = 1; const aIdx = 1;
    //     await utPolicy.createPolicy(1000, pIdx, aIdx);
    // });

    // it("should credit policy 1 [owner: 1] premium to Premium Holding Account account                                    ", async () => {
    //     const pIdx = 1;
    //     await utBank.policyPremiumCredit(td.pHash[pIdx], 2000000);
    // });

    // it("should create policy 2 [owner: 2], adjustor 1 and credit premium to Premium Holding Account account             ", async () => {
    //     const pIdx = 2; const aIdx = 1;
    //     await createPolicyCreditPremium(1200, pIdx, aIdx, 3000000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should accelerate the Pool Yield by 48 intervals (2 days)                                                       ", async () => {
    //     await utPool.acceleratePoolYield(48);  
    // });

    // // ******************************************************************************
    // // *** Test BOND
    // // ******************************************************************************

    // it("should create bond 3 [owner: 1] (SecuredReferenceBond [bond: 1]) and credit principal amount to Funding account ", async () => {
    //     const bIdx = 3; const refBondIdx = 1; const bOwnerIdx = 1;
    //     await createBondCreditPrincipal(40000, td.bHash[refBondIdx], bIdx, bOwnerIdx);
    // });

    // it("should mature bond 1 [owner: 1] and process as matured                                                          ", async () => {       
    //     const bIdx = 1;
    //     await utBond.processMaturedBond(td.bHash[bIdx]);
    // });

    // it("should create bond 4 [owner: 1] (SecuredReferenceBond [bond: 3])                                                ", async () => {
    //     const bIdx = 4; const refBondIdx = 3; const bOwnerIdx = 1;
    //     await utBond.createBond(80000, td.bHash[refBondIdx], bOwnerIdx);
    // });

    // it("should mature bond 3 [owner: 1] and process as defaulted                                                        ", async () => {       
    //     const bIdx = 3;
    //     await utBond.processMaturedBond(td.bHash[bIdx]);
    // });

    // it("should mature bond 4 [owner: 1] and process as defaulted                                                        ", async () => {       
    //     const bIdx = 4;
    //     await utBond.processMaturedBond(td.bHash[bIdx]);
    // });

    // it("should create bond 5 [owner: 5] (SecuredBondPrincipal)                                                          ", async () => {
    //     const bOwnerIdx = 5;
    //     await utBond.createBond(25000, 0x0, bOwnerIdx);
    // });

    // it("should mature bond 5 [owner: 5] and process as defaulted                                                        ", async () => {       
    //     const bIdx = 5;
    //     await utBond.processMaturedBond(td.bHash[bIdx]);
    // });

    // it("should process all outstanding bank payment advice                                                              ", async () => {
    //      await utBank.processAllOutstandginPaymentAdvice();
    // });

    // // // ******************************************************************************
    // // // *** Test OVERNIGHT PROCESSING
    // // // ******************************************************************************

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // // ******************************************************************************
    // // *** Test POLICY and SETTLEMENT
    // // ******************************************************************************

    // it("should create settlement 1 [adjustor: 2]                                                                        ", async () => {
    //     const aIdx = 2;
    //     await utSettlement.createSettlement(aIdx, miscFunc.getEmptyHash(), miscFunc.getEmptyHash());
    // });

    // it("should create settlement 2 [adjustor: 2]                                                                        ", async () => {
    //     const aIdx = 2;
    //     await utSettlement.createSettlement(aIdx, miscFunc.getEmptyHash(), miscFunc.getIdxHash(33));
    // });

    // it("should add additional info to settlement 2 [adjustor: 2]                                                        ", async () => {
    //     const sIdx = 2; const aIdx = 2;
    //     await utSettlement.addSettlementInfo(sIdx, aIdx, miscFunc.getIdxHash(67));
    // });

    // it("should add additional info to settlement 1 [adjustor: 2]                                                        ", async () => {
    //     const sIdx = 1; const aIdx = 2;
    //     await utSettlement.addSettlementInfo(sIdx, aIdx, miscFunc.getIdxHash(567));
    // });

    // it("should set expected settlement amount for settlement 1 [adjustor: 2]                                            ", async () => {
    //     const sIdx = 1; const aIdx = 2;
    //     await utSettlement.setExpectedSettlementAmount(sIdx, aIdx, 120000);
    // });

    // it("should set expected settlement amount for settlement 1 [adjustor: 2]                                            ", async () => {
    //     const sIdx = 1; const aIdx = 2;
    //     await utSettlement.setExpectedSettlementAmount(sIdx, aIdx, 110000);
    // });

    // it("should set expected settlement amount for settlement 2 [adjustor: 2]                                            ", async () => {
    //     const sIdx = 2; const aIdx = 2;
    //     await utSettlement.setExpectedSettlementAmount(sIdx, aIdx, 150000);
    // });

    // it("should set expected settlement amount for settlement 2 [adjustor: 2]                                            ", async () => {
    //     const sIdx = 2; const aIdx = 2;
    //     await utSettlement.setExpectedSettlementAmount(sIdx, aIdx, 0);
    // });

    // it("should close settlement 1 [adjustor: 2]                                                                         ", async () => {
    //     const sIdx = 1; const aIdx = 2;
    //     await utSettlement.closeSettlement(sIdx, aIdx, miscFunc.getIdxHash(1234), 55500);
    // });

    // it("should close settlement 2 [adjustor: 2]                                                                         ", async () => {
    //     const sIdx = 2; const aIdx = 2;
    //     await utSettlement.closeSettlement(sIdx, aIdx, miscFunc.getIdxHash(12134), 65500);
    // });

    // // ******************************************************************************
    // // *** Test POLICY AND POOL
    // // ******************************************************************************

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(null);
    // });

    // it("should create policy 3 [owner: 3], adjustor 1 and credit premium to Premium Holding Account account             ", async () => {
    //     const pIdx = 3; const aIdx = 1;
    //     await createPolicyCreditPremium(1200, pIdx, aIdx, 3000000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should update policy 3 [owner: 3], adjustor 1                                                                   ", async () => {
    //     const pIdx = 3; const aIdx = 1;
    //     await utPolicy.updatePolicy(td.pHash[pIdx], 500, aIdx);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should suspend policy 3 [owner: 3]                                                                              ", async () => {
    //     const pIdx = 3; const pOwnerIdx = 3;
    //     await utPolicy.suspendPolicy(td.pHash[pIdx], pOwnerIdx);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should update policy 3 [owner: 3], adjustor 1                                                                   ", async () => {
    //     const pIdx = 3; const aIdx = 1;
    //     await utPolicy.updatePolicy(td.pHash[pIdx], 800, aIdx);
    // });

    // it("should unsuspend policy 3 [owner: 3]                                                                            ", async () => {
    //     const pIdx = 3; const pOwnerIdx = 3;
    //     await utPolicy.unsuspendPolicy(td.pHash[pIdx], pOwnerIdx);
    // });

    // it("should update policy 3 [owner: 3], adjustor 1                                                                   ", async () => {
    //     const pIdx = 3; const aIdx = 1;
    //     await utPolicy.updatePolicy(td.pHash[pIdx], 1200, aIdx);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should retire policy 3 [owner: 3]                                                                               ", async () => {
    //     const pIdx = 3; const pOwnerIdx = 3;
    //     await utPolicy.retirePolicy(td.pHash[pIdx], pOwnerIdx);
    // });

    // it("should retire policy 1 [owner: 1]                                                                               ", async () => {
    //     const pIdx = 1; const pOwnerIdx = 1;
    //     await utPolicy.retirePolicy(td.pHash[pIdx], pOwnerIdx);
    // });

    // it("should process all outstanding bank payment advice                                                              ", async () => {
    //     await utBank.processAllOutstandginPaymentAdvice();
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should create policy 4 [owner: 4], adjustor 1                                                                   ", async () => {
    //     const pIdx = 4; const aIdx = 1;
    //     await utPolicy.createPolicy(1000, pIdx, aIdx);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should credit policy 4 [owner: 4] premium to Premium Holding Account account                                    ", async () => {
    //     const pIdx = 4;
    //     await utBank.policyPremiumCredit(td.pHash[pIdx], 2000000);
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });

    // it("should change the pool daylight saving time                                                                     ", async () => {
    //     await utTrust.adjustDaylightSaving();
    // });

    // it("should run all overnight processing tasks                                                                       ", async () => {
    //     await overnightProcessing(100000);
    // });
    
    // it("should print                                                                                                    ", async () => {
    //     await printLogs.printTrustLogs(null, null, null);
    //     await printLogs.printPremiums(7);
    //     await printLogs.printBankPaymentAdvice();
    //     await printLogs.printAdjustorLogs(null, null, null);
    //     await printLogs.printSettlementLogs(null, null, null);
    //     await printLogs.printPolicyLogs(null, null, null);
    //     await printLogs.printBondLogs(null, null, null);
    //     await printLogs.printPoolLogs(null, null, null);
    //     await printLogs.printBankLogs(null, null, null);
    // });
});