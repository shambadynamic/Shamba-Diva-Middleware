const axios = require('axios')
const { ethers } = require("ethers")
require("dotenv").config()
const account_private_key = process.env.ACCOUNT_PRIVATE_KEY;
const network_url = process.env.ALCHEMY_POLYGON_URL;
const provider = new ethers.providers.JsonRpcProvider(network_url);
const signer = new ethers.Wallet(account_private_key, provider);
const apiKey = process.env.POLYGONSCAN_API_KEY

const oracleFacingContractAddress = "0xC324b5aeA9d4b8c5E13891633A36E75cc6c03b26"
// const linkContractAddress = "0xb0897686c545045aFc77CF20eC7A532E3120E0F1"
const dataProviderAddress = "0xbf405c325841545033920F59E9Aa9fe3d9c3c517"
const divaDiamondAddress = "0xFf7d52432B19521276962B67FFB432eCcA609148"
const divaDiamondABI = require("./diamondABI.json");
const divaGraphUrl = "https://api.thegraph.com/subgraphs/name/divaprotocol/diva-polygon-pilot"

const sleep = ms => new Promise(res => setTimeout(res, ms));

function getContractABI(contractAddress, apiKey) {

    GeoConsumerABI_url = `https://api.polygonscan.com/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`

    return axios.get(GeoConsumerABI_url)
        .then(response => {

            return { "abi": JSON.parse(response.data.result) }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

// async function getLinkBalanceOfContract(contractAddress) {
//     const contractABI = await getContractABI(linkContractAddress, apiKey)

//     if ("abi" in contractABI) {

//         const LinkTokenContract = new ethers.Contract(
//             linkContractAddress,
//             contractABI.abi,
//             signer
//         )

//         return LinkTokenContract.balanceOf(contractAddress)
//             .then(balanceHex => {

//                 const balance = ethers.utils.formatEther(ethers.BigNumber.from(balanceHex._hex).toString())

//                 return parseFloat(balance)
//             })
//             .catch(err => {
//                 console.log('Error: ', err.toString())
//                 return 0
//             });;

//     }
//     else {
//         return 0;
//     }
// }

// async function fundContract(contractAddress, links) {

//     const contractABI = await getContractABI(linkContractAddress, apiKey)

//     if ("abi" in contractABI) {

//         const LinkTokenContract = new ethers.Contract(
//             linkContractAddress,
//             contractABI.abi,
//             signer
//         )

//         return LinkTokenContract.transfer(contractAddress, ethers.utils.parseUnits(links.toString(), 18))
//             .then(tx => {

//                 //console.log(tx.hash)
//                 return ({ "Success": `${contractAddress} is funded with ${links} LINK token(s) successfully. The corresponding transaction hash is ${tx.hash}.` })
//             })
//             .catch(err => {
//                 console.log(err.toString())
//                 return ({ "Error": `Error occured while funding the contract. Please try again.` })
//             });;

//     }
//     else {
//         return ({ "Error": "Error in the Contract's ABI" })
//     }
// }

function getEligiblePoolData() {

    timestampNow = Math.floor(Date.now() / 1000)

    timeStampBefore7Days = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)

    console.log(timestampNow, timeStampBefore7Days)

    const query = `{
        pools(orderBy: createdAt, where:{dataProvider: "${dataProviderAddress}", expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open", referenceAsset_starts_with: "https://", referenceAsset_contains: "ipfs", referenceAsset_ends_with: ".json"}) {
        id
        referenceAsset
        expiryTime
        createdAt
        }
    }`

    return axios.post(divaGraphUrl, {
        'query': query
    })
        .then(async response => {
            console.log(response.data)

            while (true) {

                lastId = response.data.data.pools[response.data.data.pools.length - 1].id

                const queryMore = `{
                    pools(where:{id_gt: ${lastId}, dataProvider: "${dataProviderAddress}", expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open", referenceAsset_starts_with: "https://", referenceAsset_contains: "ipfs", referenceAsset_ends_with: ".json"}) {
                    id
                    referenceAsset
                    expiryTime
                    createdAt
                    }
                }`

                newResponse = await axios.post(divaGraphUrl, {
                    'query': queryMore
                })

                if (newResponse.data.data.pools.length == 0) {
                    return response.data.data.pools
                }
                else {
                    response.data.data.pools = response.data.data.pools.concat(newResponse.data.data.pools)
                }

            }

        }).catch(error => {
            console.error('There was an error!', error);
            return []
        })
}

// function getEligiblePoolData() {

//     poolId = 5

//     timestampNow = Math.floor(Date.now() / 1000)

//     timeStampBefore7Days = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)

//     const DivaDiamondContract = new ethers.Contract(
//         divaDiamondAddress,
//         divaDiamondABI,
//         provider
//     )

//     return DivaDiamondContract.getPoolParameters(poolId).then(poolData => {

//         expiryTime = parseInt(poolData[13].toString())

//         createdAt = parseInt(poolData[7].toString())

//         dataProvider = poolData[14].toString()

//         referenceAsset = poolData[18].toString()

//         statusFinalReferenceValue = poolData[17]


//         if (dataProvider == dataProviderAddress && expiryTime < timestampNow && expiryTime >= timeStampBefore7Days && statusFinalReferenceValue == 0) {
//             return [{"id": poolId, "createdAt": createdAt, "expiryTime": expiryTime, "referenceAsset": referenceAsset}]
//         }
//         return []
//     })
// }

function getRequestDataFromIPFS(ipfsUrl) {
    return axios.get(ipfsUrl)
        .then(response => {

            console.log(response.data)

            return { "data": response.data }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

async function sendRequest(agg_x, dataset_code, selected_band, image_scale, start_date, end_date, geometry, pool_id) {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        gasPrice = provider.getGasPrice()

        gasLimit = GeoConsumerContract.estimateGas.requestGeostatsData(agg_x, dataset_code, selected_band, image_scale, start_date, end_date, geometry)

        return GeoConsumerContract.requestGeostatsData(agg_x, dataset_code, selected_band, image_scale, start_date, end_date, geometry, { gasLimit: gasLimit, gasPrice: gasPrice })
            .then(_ => {

                // console.log(data)
                return ({ "Success": `Request for pool id ${pool_id} has been sent to Shamba Geospatial Oracle successfully.` })
            })
            .catch(err => {
                console.log(err.toString())
                return ({ "Error": `Error for pool id ${pool_id} occured while sending request to Shamba Geospatial Oracle.` })
                //Make sure that the contract is being funded with at least 1 LINK per request.` })
            });;



    }
    else {
        return ({ "Error": "Error in the Contract's ABI" })
    }

}

async function getGeostatsData(offset) {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        return GeoConsumerContract.getGeostatsData()
            .then(geostats_data => {

                if (geostats_data.toString() == "-1" || geostats_data == 0) {
                    return "-1"
                }

                const buffer = ethers.utils.parseUnits(offset.toString(), "ether")
                return ethers.BigNumber.from(geostats_data).add(buffer).toString()   // Converting to String representation of BigNumber _hex (already in the 18-decimal integer representation)
            })
            .catch(err => {
                console.log(err.toString())
                return "-1"
            })

    }
    else {
        return "-1"
    }
}

async function setFinalReferenceValue(poolId, geostatsData) {

    const DivaDiamondContract = new ethers.Contract(
        divaDiamondAddress,
        divaDiamondABI,
        signer
    )

    gasPrice = provider.getGasPrice()

    gasLimit = DivaDiamondContract.estimateGas.setFinalReferenceValue(poolId, geostatsData, true)

    return DivaDiamondContract.setFinalReferenceValue(poolId, geostatsData, true, { gasLimit: gasLimit, gasPrice: gasPrice })
        .then(tx => {

            if (tx.hash != undefined) {
                return `Transaction for pool id ${poolId} is successful with transaction hash as ${tx.hash}. See details on https://polygonscan.com/tx/${tx.hash}.`
            }

        })
        .catch(err => {
            console.log(err.toString())
            return "Error while doing the transaction."
        })

}

function isValidRequest(requestData, poolExpiryTime, poolCreationTime) {

    agg_x = requestData.agg_x
    dataset = requestData.dataset
    band = requestData.band
    scale = requestData.scale
    start_date_string = requestData.start_date
    end_date_string = requestData.end_date
    geometry = requestData.geometry
    offset = requestData.offset

    pool_expiry_date_string = (new Date(parseInt(poolExpiryTime) * 1000)).toISOString().split('T')[0];
    pool_creation_date_string = (new Date(parseInt(poolCreationTime) * 1000)).toISOString().split('T')[0];

    if (offset >= 0) {
        if (agg_x == "agg_mean" || agg_x == "agg_max" || agg_x == "agg_min" || agg_x == "agg_median" || agg_x == "agg_stdDev" || agg_x == "agg_variance") {
            if (dataset == "eVIIRS_NDVI" && band == "NDVI" && scale == "1000") {
                today = new Date()
                // tenDaysAgo = new Date(new Date().setDate(today.getDate() - 10))
                start_date = new Date(start_date_string)
                end_date = new Date(end_date_string)
                pool_expiry_date = new Date(pool_expiry_date_string)
                pool_creation_date = new Date(pool_creation_date_string)

                diffTime = Math.abs(end_date - start_date)
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                diffTime_Pool = Math.abs(pool_expiry_date - end_date)
                diffDays_Pool = Math.ceil(diffTime_Pool / (1000 * 60 * 60 * 24))

                if (diffDays >= 30 && diffDays_Pool >= 10 && start_date > pool_creation_date) {

                    if (geometry != undefined && geometry.hasOwnProperty("features") && geometry.features.length > 0) {

                        var i = 0

                        while (i < geometry.features.length) {
                            if (!geometry.features[i].hasOwnProperty("geometry")) {
                                break
                            }
                            else {
                                if (!geometry.features[i].geometry.hasOwnProperty("coordinates")) {
                                    break
                                }
                            }
                            i += 1
                        }

                        if (i == geometry.features.length) {
                            return true
                        }

                    }
                }
            }
        }

    }

    return false

}

exports.shambaDivaMiddleware = (event, context) => {

    getEligiblePoolData().then((poolDataList) => {
        // console.log(poolDataList)
        for (var poolData of poolDataList) {
            console.log(poolData)
            getRequestDataFromIPFS(poolData.referenceAsset).then((requestData) => {
                if (requestData.data != undefined) {

                    if (isValidRequest(requestData.data, poolData.expiryTime, poolData.createdAt)) {

                        agg_x = requestData.data.agg_x
                        dataset = requestData.data.dataset
                        band = requestData.data.band
                        scale = requestData.data.scale
                        start_date = requestData.data.start_date
                        end_date = requestData.data.end_date
                        geometry = requestData.data.geometry
                        offset = requestData.data.offset

                        geometry_array = []

                        for (geometry_map of geometry.features) {
                            geometry_array.push([geometry_map.properties.id, JSON.stringify(geometry_map.geometry.coordinates)])
                        }

                        // getLinkBalanceOfContract(oracleFacingContractAddress).then(async balance => {

                        //     if (balance < 1) {
                        //         console.log('balance < 1')
                        //         fundContract(oracleFacingContractAddress, 1).then(async result => {
                        //             if (result != undefined && result.Success != undefined) {
                        //                 request = await sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array)

                        //                 console.log(request)

                        //                 if (request != undefined && request.Success != undefined) {
                        //                     sleep(60000).then(async _ => {
                        //                         geostats_data = await getGeostatsData(offset)

                        //                         if (parseInt(geostats_data) != 0) {

                        //                             console.log(geostats_data)

                        //                             finalResult = await setFinalReferenceValue(parseInt(poolData.id), geostats_data)

                        //                             console.log(finalResult)

                        //                         }

                        //                     })
                        //                 }
                        //             }
                        //         })
                        //     }
                        //     else {

                        //         console.log('balance >= 1')
                        //         request = await sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array)

                        //         console.log(request)

                        //         if (request != undefined && request.Success != undefined) {
                        //             sleep(60000).then(async _ => {
                        //                 geostats_data = await getGeostatsData(offset)

                        //                 console.log(geostats_data)

                        //                 finalResult = await setFinalReferenceValue(parseInt(poolData.id), geostats_data)

                        //                 console.log(finalResult)

                        //             })
                        //         }
                        //     }
                        // })

                        sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array, poolData.id).then((request) => {
                            console.log(request)

                            if (request != undefined && request.Success != undefined) {
                                sleep(60000).then(() => {
                                    getGeostatsData(offset).then((geostatsData) => {
                                        geostats_data = geostatsData

                                        console.log(geostats_data)

                                        tries = 1

                                        while (geostats_data == "-1" && tries < 3) {

                                            console.log("Try: ", tries)

                                            sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array, poolData.id).then((request) => {
                                                // console.log(request)

                                                if (request != undefined && request.Success != undefined) {
                                                    sleep(60000).then(() => {
                                                        getGeostatsData(offset).then((geostatsData) => {
                                                            geostats_data = geostatsData
                                                            tries += 1
                                                        })
                                                    })
                                                }

                                            })

                                        }

                                        setFinalReferenceValue(parseInt(poolData.id), geostats_data).then((finalResult) => {
                                            console.log(finalResult)

                                        })

                                    })


                                })
                            }
                        })


                    }
                }

            })


        }
    })

};