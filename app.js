const axios = require('axios')
const { ethers } = require("ethers")
require("dotenv").config()
const account_private_key = process.env.ACCOUNT_PRIVATE_KEY;
const network_url = process.env.ALCHEMY_GOERLI_URL;
const provider = new ethers.providers.JsonRpcProvider(network_url);
const signer = new ethers.Wallet(account_private_key, provider);
const apiKey = process.env.ETHERSCAN_API_KEY

const oracleFacingContractAddress = "0xd4Ab99248EA3Dd7dC4805733E182052ABDC95152"
const linkContractAddress = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"
const dataProviderAddress = "0x8c244f0b2164e6a3bed74ab429b0ebd661bb14ca"
const divaDiamondAddress = "0x659f8bF63Dce2548eB4D9b4BfF6883dddFde4848"
const divaDiamondABI = require("./diamondABI.json");
const divaGraphUrl = "https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new-2"

const sleep = ms => new Promise(res => setTimeout(res, ms));

function getContractABI(contractAddress, apiKey) {

    GeoConsumerABI_url = `https://api-goerli.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`

    return axios.get(GeoConsumerABI_url)
        .then(response => {

            return { "abi": JSON.parse(response.data.result) }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

async function getLinkBalanceOfContract(contractAddress) {
    const contractABI = await getContractABI(linkContractAddress, apiKey)

    if ("abi" in contractABI) {

        const LinkTokenContract = new ethers.Contract(
            linkContractAddress,
            contractABI.abi,
            signer
        )

        return LinkTokenContract.balanceOf(contractAddress)
            .then(balanceHex => {

                const balance = ethers.utils.formatEther(ethers.BigNumber.from(balanceHex._hex).toString())

                return parseFloat(balance)
            })
            .catch(err => {
                console.log('Error: ', err.toString())
                return 0
            });;

    }
    else {
        return 0;
    }
}

async function fundContract(contractAddress, links) {

    const contractABI = await getContractABI(linkContractAddress, apiKey)

    if ("abi" in contractABI) {

        const LinkTokenContract = new ethers.Contract(
            linkContractAddress,
            contractABI.abi,
            signer
        )

        return LinkTokenContract.transfer(contractAddress, ethers.utils.parseUnits(links.toString(), 18))
            .then(tx => {

                //console.log(tx.hash)
                return ({ "Success": `${contractAddress} is funded with ${links} LINK token(s) successfully. The corresponding transaction hash is ${tx.hash}.` })
            })
            .catch(err => {
                console.log(err.toString())
                return ({ "Error": `Error occured while funding the contract. Please try again.` })
            });;

    }
    else {
        return ({ "Error": "Error in the Contract's ABI" })
    }
}

function getEligiblePoolData() {

    timestampNow = Math.floor(Date.now() / 1000)

    timeStampBefore7Days = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)

    const query = `{
        pools(orderBy: createdAt, where:{dataProvider: ${dataProviderAddress}, expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open"}) {
        id
        referenceAsset
        expiryTime
        }
    }`

    return axios.post(divaGraphUrl, {
        'query': query
    })
        .then(response => {
            // console.log(response.data)

            while (true) {

                lastId = response.data.data.pools[response.data.data.pools.length - 1].id

                const queryMore = `{
                    pools(where:{id_gt: ${lastId}, dataProvider: ${dataProviderAddress}, expiryTime_lt: ${timestampNow}, expiryTime_gte: ${timeStampBefore7Days}, statusFinalReferenceValue: "Open"}) {
                    id
                    referenceAsset
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

            //console.log(response.data)

            return { "data": response.data }

        }).catch(error => {
            console.error('There was an error!', error)
            return { "Error": error.message }
        });
}

async function sendRequest(agg_x, dataset_code, selected_band, image_scale, start_date, end_date, geometry) {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        return GeoConsumerContract.requestGeostatsData(agg_x, dataset_code, selected_band, image_scale, start_date, end_date, geometry)
            .then(_ => {

                // console.log(data)
                return ({ "Success": "Request has been sent to Shamba Geospatial Oracle successfully." })
            })
            .catch(err => {
                console.log(err.toString())
                return ({ "Error": "Error occured while sending request to Shamba Geospatial Oracle. Make sure that the contract is being funded with at least 1 LINK per request." })
            });;



    }
    else {
        return ({ "Error": "Error in the Contract's ABI" })
    }

}

async function getGeostatsData() {

    const contractABI = await getContractABI(oracleFacingContractAddress, apiKey)

    if ("abi" in contractABI) {

        const GeoConsumerContract = new ethers.Contract(
            oracleFacingContractAddress,
            contractABI.abi,
            signer
        )

        return GeoConsumerContract.getGeostatsData()
            .then(geostats_data => {
                return geostats_data.toString()   // Converting to String representation of BigNumber _hex (already in the 18-decimal integer representation)
            })
            .catch(err => {
                console.log(err.toString())
                return "0"
            })

    }
    else {
        return "0"
    }
}

async function setFinalReferenceValue(poolId, geostatsData) {

    const DivaDiamondContract = new ethers.Contract(
        divaDiamondAddress,
        divaDiamondABI,
        signer
    )

    return DivaDiamondContract.setFinalReferenceValue(poolId, geostatsData, true)
        .then(tx => {

            if (tx.hash != undefined) {
                return `Transaction is successful with transaction hash as ${tx.hash}. See details on https://goerli.etherscan.io/tx/${tx.hash}.`
            }

        })
        .catch(err => {
            console.log(err.toString())
            return "Error while doing the transaction."
        })

}

function isValidRequest(requestData, poolExpiryTime) {

    agg_x = requestData.agg_x
    dataset = requestData.dataset
    band = requestData.band
    scale = requestData.scale
    start_date_string = requestData.start_date
    end_date_string = requestData.end_date
    geometry = requestData.geometry

    pool_expiry_date_string = (new Date(parseInt(poolExpiryTime) * 1000)).toISOString().split('T')[0];

    if (agg_x == "agg_mean" || agg_x == "agg_max" || agg_x == "agg_min" || agg_x == "agg_median" || agg_x == "agg_stdDev" || agg_x == "agg_variance") {
        if (dataset == "MODIS/MOD09GA_006_NDVI" && band == "NDVI" && scale == "463.313") {
            today = new Date()
            tenDaysAgo = new Date(new Date().setDate(today.getDate() - 10))
            start_date = new Date(start_date_string)
            end_date = new Date(end_date_string)

            if (start_date < tenDaysAgo && start_date < end_date && end_date_string == pool_expiry_date_string) {
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

    return false

}

exports.shambaDivaMiddleware = async (event, context) => {

    poolDataList = await getEligiblePoolData()

    for (var poolData of poolDataList) {
        requestData = await getRequestDataFromIPFS(poolData.referenceAsset)

        if (requestData.data != undefined) {

            if (isValidRequest(requestData.data, poolData.expiryTime)) {

                agg_x = requestData.data.agg_x
                dataset = requestData.data.dataset
                band = requestData.data.band
                scale = requestData.data.scale
                start_date = requestData.data.start_date
                end_date = requestData.data.end_date
                geometry = requestData.data.geometry

                geometry_array = []

                for (geometry_map of geometry.features) {
                    geometry_array.push([geometry_map.properties.id, JSON.stringify(geometry_map.geometry.coordinates)])
                }

                getLinkBalanceOfContract(oracleFacingContractAddress).then(async balance => {

                    if (balance < 1) {
                        console.log('balance < 1')
                        fundContract(oracleFacingContractAddress, 1).then(async result => {
                            if (result != undefined && result.Success != undefined) {
                                request = await sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array)

                                console.log(request)

                                if (request != undefined && request.Success != undefined) {
                                    sleep(60000).then(async _ => {
                                        geostats_data = await getGeostatsData()

                                        if (parseInt(geostats_data) != 0) {

                                            console.log(geostats_data)

                                            finalResult = await setFinalReferenceValue(parseInt(poolData.id), ethers.BigNumber.from(geostats_data))

                                            console.log(finalResult)

                                        }

                                    })
                                }
                            }
                        })
                    }
                    else {

                        console.log('balance >= 1')
                        request = await sendRequest(agg_x, dataset, band, scale, start_date, end_date, geometry_array)

                        console.log(request)

                        if (request != undefined && request.Success != undefined) {
                            sleep(60000).then(async _ => {
                                geostats_data = await getGeostatsData()

                                console.log(geostats_data)

                                finalResult = await setFinalReferenceValue(parseInt(poolData.id), ethers.BigNumber.from(geostats_data))

                                console.log(finalResult)

                            })
                        }
                    }
                })
            }
        }
    }

};