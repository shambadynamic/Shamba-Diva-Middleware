# Shamba-Diva Middleware

## Introduction

1. This script is created as a middleware for [Diva Protocol](https://www.divaprotocol.io/) interaction with [Shamba Geospatial Oracle](https://shamba.network).

2. It is deployed as a [GCP Cloud Function](https://cloud.google.com/functions) with trigger-type as [GCP Pub/Sub](https://cloud.google.com/functions/docs/calling/pubsub) based on [GCP Cloud Scheduler](https://cloud.google.com/scheduler) scheduled at 00:00 UTC everyday. 

## What it does ?

It fetches all the **eligible expired pools** created using [Diva Protocol App](https://app.diva.finance/) from the [Diva Graph](https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-goerli-new). 

### What are eligible expired pools ?

Being Shamba Network as Geospatial Data Provider, the eligible expired pools means the pools whose expiry date is passed and it's not being 7 days after expiry. And also while creating the pool, the **Reference Asset** and the **Data Provider** selected as the [IPFS](https://web3.storage/) url of the Geo-JSON file and the [Shamba Network's Wallet Address](https://goerli.etherscan.io/address/0x8C244f0B2164E6A3BED74ab429B0ebd661Bb14CA) (i.e., `0x8C244f0B2164E6A3BED74ab429B0ebd661Bb14CA`) respectively. 

Below is the content of a sample Geo-JSON file:

```
{
    "dataset": "MODIS/006/MOD13Q1",
    "band": "NDVI",
    "scale": "250",
    "start_date": "2022-06-01",
    "end_date": "2022-08-31",
    "geometry": {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": 1
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [
                                38.03466796875,
                                2.4327403948333925
                            ],
                            [
                                38.03466796875,
                                2.9101249120129142
                            ],
                            [
                                38.6553955078125,
                                2.9101249120129142
                            ],
                            [
                                38.6553955078125,
                                2.4327403948333925
                            ],
                            [
                                38.03466796875,
                                2.4327403948333925
                            ]
                        ]
                    ]
                }
            }
        ]
    }
}
```

IPFS url of this file: https://bafybeiecrkc4rl4yadcbt47lwuv75xw3fmhmb4wolluap77ffzmy72smh4.ipfs.w3s.link/shamba-reference-asset.json

### Requesting the data from the Shamba Geospatial Oracle 

It sends the request to the Shamba Geospatial Oracle by fetching the request parameters from the Reference Asset (i.e., the url of the Geo-JSON file stored on IPFS) and then passing them as parameters to the [OracleFacingGeoConsumer Smart Contract](https://goerli.etherscan.io/address/0xd4Ab99248EA3Dd7dC4805733E182052ABDC95152) via `requestGeostatsData` function inherited from ShambaGeoConsumer contract available in [Shamba Smart Contract Kit](https://github.com/shambadynamic/shamba-smartcontractkit).

### Receiving the data from the Shamba Geospatial Oracle 

After the request being made, the corresponding response is received in the form of geostats-data (as 18 decimal integer representation) via `getGeostatsData` function.

### Setting the final reference value of the pool

After receiving the response from the Shamba Geospatial Oracle, the final reference value of the corresponding pool is set by calling the `setFinalReferenceValue` function of the [Diva Settlement Facet](https://goerli.etherscan.io/address/0x92c30A4bA4677F5388Aa270087FAb25660648A1D) through the [Diva Diamond Contract](https://goerli.etherscan.io/address/0x2d941518E0876Fb6042bfCdB403427DC5620b2EC) by passing the parameters as `_poolId`, `_finalReferenceValue` having `geostats_data` (18 decimal integer representation) and `_allowChallenge` boolean as `true`.










