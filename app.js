const axios = require('axios')
const { ethers } = require("ethers")
require("dotenv").config()
const account_private_key = process.env.ACCOUNT_PRIVATE_KEY;
const network_url = process.env.ALCHEMY_POLYGON_URL;
const provider = new ethers.providers.JsonRpcProvider(network_url);
const signer = new ethers.Wallet(account_private_key, provider);
const apiKey = process.env.POLYGONSCAN_API_KEY

const oracleFacingContractAddress = process.env.ORACLE_FACING_CONTRACT_ADDRESS
const dataProviderAddress = process.env.DATA_PROVIDER_ADDRESS
const divaDiamondAddress = process.env.DIVA_DIAMOND_ADDRESS
const divaDiamondABI = require("./diamondABI.json");
const divaGraphUrl = process.env.DIVA_GRAPH_API_URL

const sleep = ms => new Promise(res => setTimeout(res, ms));

function getContractABI(contractAddress, apiKey) {

    ABI_url = `${process.env.POLYGONSCAN_API_ROOT_URL}/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`

    return axios.get(ABI_url)
        .then(response => {

            return { "abi": JSON.parse(response.data.result) }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

function getEligiblePoolData() {

    timestampNow = Math.floor(Date.now() / 1000)

    timeStampBefore7Days = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)

    // It's a conscious decision to not include statusFinalReferenceValue = "Challenged" to avoid resubmitting values automatically when a submission is challenged

    const query = `{
        pools(where:{dataProvider: "${dataProviderAddress}", expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open", referenceAsset_starts_with: "https://", referenceAsset_contains: "ipfs", referenceAsset_ends_with: ".json"}) {
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

            while (true) {

                lastId = response.data.data.pools[response.data.data.pools.length - 1].id

                const queryMore = `{
                    pools(where:{id_gt: "${lastId}", dataProvider: "${dataProviderAddress}", expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open", referenceAsset_starts_with: "https://", referenceAsset_contains: "ipfs", referenceAsset_ends_with: ".json"}) {
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

function getRequestDataFromIPFS(ipfsUrl) {
    return axios.get(ipfsUrl)
        .then(response => {

            return { "data": response.data }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

async function sendRequest(requestIpfsCid, pool_id) {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        gasPrice = provider.getGasPrice()

        gasLimit = GeoConsumerContract.estimateGas.requestGeostatsData(requestIpfsCid)

        return GeoConsumerContract.requestGeostatsData(requestIpfsCid, {gasLimit: gasLimit, gasPrice: gasPrice})
            .then(_ => {

                return ({ "Success": `Request for pool id ${pool_id} has been sent to Shamba Geospatial Oracle successfully.` })
            })
            .catch(err => {
                console.log(err.toString())
                return ({ "Error": `Error for pool id ${pool_id} occured while sending request to Shamba Geospatial Oracle.` }) 
  
            });;

    }
    else {
        return ({ "Error": "Error in the Contract's ABI" })
    }

}

async function getLatestGeostatsData(offset) {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        return GeoConsumerContract.getLatestGeostatsData()
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

    return DivaDiamondContract.setFinalReferenceValue(poolId, geostatsData, true, {gasLimit: gasLimit, gasPrice: gasPrice})
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
    dataset_code = requestData.dataset_code
    selected_band = requestData.selected_band
    image_scale = requestData.image_scale
    start_date_string = requestData.start_date
    end_date_string = requestData.end_date
    geometry = requestData.geometry
    offset = requestData.offset

    pool_expiry_date_string = (new Date(parseInt(poolExpiryTime) * 1000)).toISOString().split('T')[0];
    pool_creation_date_string = (new Date(parseInt(poolCreationTime) * 1000)).toISOString().split('T')[0];

    if (offset >= 0) {
        if (agg_x == "agg_mean" || agg_x == "agg_max" || agg_x == "agg_min" || agg_x == "agg_median" || agg_x == "agg_stdDev" || agg_x == "agg_variance") {
            if (dataset_code == "eVIIRS_NDVI" && selected_band == "NDVI" && image_scale == "1000") {
                today = new Date()
                start_date = new Date(start_date_string)
                end_date = new Date(end_date_string)
                pool_expiry_date = new Date(pool_expiry_date_string)
                pool_creation_date = new Date(pool_creation_date_string)

                diffTime = Math.abs(end_date - start_date)
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                diffTime_Pool = Math.abs(pool_expiry_date - end_date)
                diffDays_Pool = Math.ceil(diffTime_Pool / (1000 * 60 * 60 * 24))

                if (diffDays >= 30 && diffDays_Pool >= 10
                    && start_date > pool_creation_date    // Comment this condition for testing
                    ) {

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

    getEligiblePoolData().then(async (poolDataList) => {
        for (var poolData of poolDataList) {
            await getRequestDataFromIPFS(poolData.referenceAsset).then(async (requestData) => {
                if (requestData.data) {

                    if (isValidRequest(requestData.data, poolData.expiryTime, poolData.createdAt)) {
    
                        requestIpfsCid = poolData.referenceAsset
                        offset = requestData.data.offset

    
                        await sendRequest(requestIpfsCid, poolData.id).then(async (request) => {
    
                            if (request != undefined && request.Success != undefined) {
                                await sleep(60000).then(async () => {
                                    await getLatestGeostatsData(offset).then(async (geostatsData) => {
                                        var geostats_data = geostatsData
    
    
                                        tries = 1
    
                                        while (geostats_data == "-1" && tries < 3) {
    
                                            console.log("Try: ", tries)
    
                                            await sendRequest(requestIpfsCid, poolData.id).then(async (request) => {
    
                                                if (request != undefined && request.Success != undefined) {
                                                    await sleep(60000).then(async () => {
                                                        await getLatestGeostatsData(offset).then((geostatsData) => {
                                                            geostats_data = geostatsData
                                                            tries += 1
                                                        })
                                                    })
                                                }
    
                                            })
                                            
                                        }

                                        if (geostats_data != "-1") {
                                            await setFinalReferenceValue(poolData.id, geostats_data).then((finalResult) => {
                                                console.log(finalResult)
                                            })
                                        }
    
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