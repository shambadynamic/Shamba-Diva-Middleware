# Shamba-Diva Middleware

## Introduction

1. This script is created as a middleware for [Diva Protocol](https://www.divaprotocol.io/) interaction with [Shamba Geospatial Oracle](https://shamba.network).
2. It is deployed as a [GCP Cloud Function](https://cloud.google.com/functions) with trigger-type as [GCP Pub/Sub](https://cloud.google.com/functions/docs/calling/pubsub) based on [GCP Cloud Scheduler](https://cloud.google.com/scheduler) scheduled at 00:00 UTC everyday.

## What it does ?

It fetches all the **eligible expired pools** created using [Diva Protocol App](https://app.diva.finance/) from the [Diva Graph](https://thegraph.com/hosted-service/subgraph/divaprotocol/diva-polygon-pilot).

### What are eligible expired pools ?

Being Shamba Network as Geospatial Data Provider, the eligible expired pools means the pools whose expiry date is passed and it's not being 7 days after expiry. And also while creating the pool, the **Reference Asset** and the **Data Provider** selected as the [IPFS](https://web3.storage/) url of the Geo-JSON file and the [Shamba Network&#39;s Wallet Address](https://polygonscan.com/address/0xbf405c325841545033920F59E9Aa9fe3d9c3c517) (i.e., `0xbf405c325841545033920F59E9Aa9fe3d9c3c517`) respectively.

Below is the content of a sample Geo-JSON file:

```
{
    "agg_x": "agg_mean",
    "dataset_code": "eVIIRS_NDVI",
    "selected_band": "NDVI",
    "image_scale": "1000",
    "start_date": "2023-03-01",
    "end_date": "2023-05-31",
    "offset": 1,
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
                                36.45568848,
                                2.61151123
                            ],
                            [
                                36.46392822,
                                2.60968018
                            ],
                            [
                                36.47052002,
                                2.61029053
                            ],
                            [
                                36.47290039,
                                2.60931396
                            ]
                        ]
                    ]
                }
            }
        ]
    }
}
```

IPFS url of a sample Geo-JSON file: [https://bafybeift2h7ja2ldonntvfhdmu7fvvkiiajcbsmw5mzc774iybvimkcyqy.ipfs.w3s.link/shamba_reference_asset_kajiado_test.json](https://bafybeift2h7ja2ldonntvfhdmu7fvvkiiajcbsmw5mzc774iybvimkcyqy.ipfs.w3s.link/shamba_reference_asset_kajiado_test.json)

### Requesting the data from the Shamba Geospatial Oracle

It sends the request to the Shamba Geospatial Oracle by fetching the request parameters from the Reference Asset (i.e., the url of the Geo-JSON file stored on IPFS) and then passing the same url as parameter to the [OracleFacingGeoConsumer Smart Contract](https://mumbai.polygonscan.com/address/0xd4472aB370dF4AA27Dc5cCe921307e2bE9Bcf041) via `requestGeostatsData` function inherited from ShambaGeoConsumer contract available in [Shamba Smart Contract Kit](https://github.com/shambadynamic/shamba-smartcontractkit).

### Receiving the data from the Shamba Geospatial Oracle

After the request being made, the corresponding response is received in the form of geostats-data (as 18 decimal integer representation) via `getGeostatsData` function.

### Setting the final reference value of the pool

After receiving the response from the Shamba Geospatial Oracle, the final reference value of the corresponding pool is set by calling the `setFinalReferenceValue` function of the [Diva Settlement Facet](https://polygonscan.com/address/0x2fb975729e222a3983b090aa700cacb00ae186cf) through the [Diva Diamond Contract](https://polygonscan.com/address/0x2C9c47E7d254e493f02acfB410864b9a86c28e1D) by passing the parameters as `_poolId`, `_finalReferenceValue` having `geostats_data` (18 decimal integer representation) and `_allowChallenge` boolean as `true`.
