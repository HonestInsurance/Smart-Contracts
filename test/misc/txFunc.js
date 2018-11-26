/**
 * @description Various helper functions required for testing the contacts
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */
  
// // Found here https://gist.github.com/xavierlepretre/afab5a6ca65e0c52eaf902b50b807401
// exports.getEventsPromise = function (myFilter, count) {
//     return new Promise(function (resolve, reject) 
//     {
//         count = count ? count : 1;
//         let results = [];
//         myFilter.watch(function (error, result) {
//         if (error) {
//             reject(error);
//         } else {
//             count--;
//             results.push(result);
//         }
//         if (count <= 0) {
//             resolve(results);
//             myFilter.stopWatching();
//         }
//         });
//     });
// };

// // Found here https://gist.github.com/xavierlepretre/d5583222fde52ddfbc58b7cfa0d2d0a9
// exports.expectedExceptionPromise = function (action, gasToUse) {
//     return new Promise(function (resolve, reject) {
//         try {
//             resolve(action());
//         } catch(e) {
//             reject(e);
//         }
//     })
//     .then(function (txObj) {
//         return typeof txObj === "string" 
//             ? web3.eth.getTransactionReceiptMined(txObj) // regular tx hash
//             : typeof txObj.receipt !== "undefined"
//                 ? txObj.receipt // truffle-contract function call
//                 : typeof txObj.transactionHash === "string"
//                     ? web3.eth.getTransactionReceiptMined(txObj.transactionHash) // deployment
//                     : txObj; // Unknown last case
//     })
//     .then(
//         function (receipt) {
//             // We are in Geth
//             if (typeof receipt.status !== "undefined") {
//                 // Byzantium
//                 assert.strictEqual(parseInt(receipt.status), 0, "should have reverted");
//             } else {
//                 // Pre Byzantium
//                 assert.equal(receipt.gasUsed, gasToUse, "should have used all the gas");
//             }
//         },
//         function (e) {
//             if ((e + "").indexOf("invalid JUMP") > -1 ||
//                     (e + "").indexOf("out of gas") > -1 ||
//                     (e + "").indexOf("invalid opcode") > -1 ||
//                     (e + "").indexOf("revert") > -1) {
//                 // We are in TestRPC
//             } else if ((e + "").indexOf("please check your gas amount") > -1) {
//                 // We are in Geth for a deployment
//             } else {
//                 throw e;
//             }
//         }
//     );
// };