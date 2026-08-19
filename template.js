const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const makeString = require('makeString');
const makeTableMap = require('makeTableMap');
const sendHttpRequest = require('sendHttpRequest');
const sha256Sync = require('sha256Sync');
const templateDataStorage = require('templateDataStorage');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const api = data.apiSelect;
const endpoint = api === 'core' ? data.coreEndpoint : data.loyaltyEndpoint;
const requestConfig = requestConfigMap(api, endpoint);

sendRequest(api, requestConfig);

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getCoreTokenCacheKey(storeId, apiSecret) {
  return sha256Sync('yotpo_core_token_' + storeId + '_' + apiSecret);
}

function generateNewToken(apiSecret, storeId) {
  const requestBody = JSON.stringify({ secret: apiSecret });
  const generateTokenUrl =
    'https://api.yotpo.com/core/v3/stores/' + enc(storeId) + '/access_tokens';

  return sendHttpRequest(
    generateTokenUrl,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'Content-Type': 'application/json' }
    },
    requestBody
  )
    .then((response) => {
      const responseBody = JSON.parse(response.body || '{}');
      if (response.statusCode < 200 || response.statusCode >= 300 || !responseBody.access_token) {
        return undefined;
      }

      templateDataStorage.setItemCopy(
        getCoreTokenCacheKey(storeId, apiSecret),
        responseBody.access_token
      );
      return responseBody.access_token;
    })
    .catch(() => undefined);
}

function requestConfigMap(api, endpoint) {
  const coreBaseUrl = 'https://api.yotpo.com/core/v3/stores/' + enc(data.coreStoreId);
  const loyaltyBaseUrl = 'https://loyalty.yotpo.com/api/v2';
  const coreAPIHeaders = {
    accept: 'application/json',
    'Content-Type': 'application/json'
  };
  const loyaltyAPIHeaders = {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-KEY': data.loyaltyApiKey,
    'X-GUID': data.loyaltyGUID
  };

  const configByApiAndEndpoint = {
    core: {
      createOrUpdateCustomer: {
        baseUrl: coreBaseUrl,
        endpointPath: '/customers',
        body: getCreateOrUpdateCustomerRequestBody,
        options: {
          method: 'PATCH',
          headers: coreAPIHeaders
        }
      },
      createOrder: {
        baseUrl: coreBaseUrl,
        endpointPath: '/orders',
        body: getCreateOrderRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      },
      createOrderFulfillment: {
        baseUrl: coreBaseUrl,
        endpointPath: '/orders/' + enc(data.orderId) + '/fulfillments',
        body: getCreateOrderFulfillmentRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      },
      sendAggregatedOrder: {
        baseUrl: coreBaseUrl,
        endpointPath: '/register_purchase',
        body: getAggregatedOrderRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      }
    },
    loyalty: {
      createLoyaltyCustomer: {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/customers',
        body: getCreateLoyaltyCustomerRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      },
      createLoyaltyCustomerAction: {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/actions',
        body: getCreateLoyaltyCustomerActionRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      },
      createLoyaltyOrder: {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/orders',
        body: getCreateLoyaltyOrderRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      }
    }
  };

  return configByApiAndEndpoint[api][endpoint];
}

function getRequestBodyObject(
  parametersTableName,
  customParametersTableName,
  customPropertiesPrefix
) {
  const flatObject = data[parametersTableName]
    ? makeTableMap(data[parametersTableName], 'key', 'value')
    : {};

  if (customParametersTableName) {
    addCustomProperties(flatObject, data[customParametersTableName], customPropertiesPrefix);
  }

  return convertDotNotationFlatObjectToNestedObject(flatObject);
}

function addCustomProperties(flatObject, customParametersTable, prefix) {
  if (!customParametersTable || !customParametersTable.length) return;

  const customProperties = makeTableMap(customParametersTable, 'key', 'value');
  for (const key in customProperties) {
    flatObject[prefix + key] = customProperties[key];
  }
}

function addAutoMappedIpAndUserAgent(bodyObject, eventData) {
  if (!bodyObject.ip_address && eventData.ip_override) {
    bodyObject.ip_address = eventData.ip_override;
  }
  if (!bodyObject.user_agent && eventData.user_agent) {
    bodyObject.user_agent = eventData.user_agent;
  }

  return bodyObject;
}

function getCreateOrUpdateCustomerRequestBody() {
  return JSON.stringify(
    getRequestBodyObject(
      'createOrUpdateCustomerParameters',
      'createOrUpdateCustomerCustomParameters',
      'customer.'
    )
  );
}

function getCreateOrderRequestBody() {
  return JSON.stringify(
    getRequestBodyObject('createOrderParameters', 'createOrderAdditionalParameters', '')
  );
}

function getCreateOrderFulfillmentRequestBody() {
  return JSON.stringify(getRequestBodyObject('createOrderFulfillmentParameters'));
}

function getAggregatedOrderRequestBody() {
  return JSON.stringify(
    getRequestBodyObject(
      'sendAggregatedOrderParameters',
      'sendAggregatedOrderAdditionalParameters',
      ''
    )
  );
}

function getCreateLoyaltyCustomerRequestBody() {
  return JSON.stringify(getRequestBodyObject('createLoyaltyCustomerParameters'));
}

function getCreateLoyaltyCustomerActionRequestBody() {
  return JSON.stringify(
    addAutoMappedIpAndUserAgent(
      getRequestBodyObject('createLoyaltyCustomerActionParameters'),
      eventData
    )
  );
}

function getCreateLoyaltyOrderRequestBody() {
  return JSON.stringify(
    addAutoMappedIpAndUserAgent(
      getRequestBodyObject(
        'createLoyaltyOrderParameters',
        'createLoyaltyOrderAdditionalParameters',
        ''
      ),
      eventData
    )
  );
}

function sendRequest(api, requestConfig) {
  if (api !== 'core') return callApi(api, requestConfig);

  const tokenCacheKey = getCoreTokenCacheKey(data.coreStoreId, data.coreApiSecret);
  const cachedToken = templateDataStorage.getItemCopy(tokenCacheKey);
  if (cachedToken) return callApi(api, requestConfig, cachedToken);

  return generateNewToken(data.coreApiSecret, data.coreStoreId).then((accessToken) => {
    if (accessToken) return callApi(api, requestConfig, accessToken);
    if (!data.useOptimisticScenario) return data.gtmOnFailure();
  });
}

function callApi(api, requestConfig, accessToken, isRetry) {
  const url = requestConfig.baseUrl + requestConfig.endpointPath;
  const requestOptions = requestConfig.options;
  const body = requestConfig.body();

  // The access token only applies to the Core API; Loyalty authenticates with the
  // API Key/GUID headers already set on requestConfig, so nothing to add here.
  if (api === 'core') requestOptions.headers['X-Yotpo-Token'] = accessToken;

  return sendHttpRequest(url, requestOptions, body)
    .then((response) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        // The optimistic scenario already called gtmOnSuccess() synchronously above, so it's
        // skipped here to avoid a second, out-of-band callback after GTM has already moved on.
        if (!data.useOptimisticScenario) return data.gtmOnSuccess();
        return;
      }

      // The token retry only applies to the Core API, and always runs even under the
      // optimistic scenario, so a stale/expired cached token still gets refreshed for the
      // next real request.
      if (api === 'core' && !isRetry && response.statusCode === 401) {
        return generateNewToken(data.coreApiSecret, data.coreStoreId).then((newAccessToken) => {
          if (newAccessToken) return callApi(api, requestConfig, newAccessToken, true);
          if (!data.useOptimisticScenario) return data.gtmOnFailure();
        });
      }

      if (!data.useOptimisticScenario) return data.gtmOnFailure();
    })
    .catch(() => {
      if (!data.useOptimisticScenario) return data.gtmOnFailure();
    });
}

/*==============================================================================
  Helpers
==============================================================================*/

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  const url = eventData.page_location || getRequestHeader('referer');
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function convertDotNotationFlatObjectToNestedObject(flatObject) {
  const rootObject = {};

  for (const flatKey in flatObject) {
    const keys = flatKey.split('.');
    let current = rootObject;

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      const nextKey = keys[i + 1];

      if (current[currentKey] === undefined || current[currentKey] === null) {
        const isNextKeyNumeric = nextKey.match('^[0-9]+$');
        current[currentKey] = isNextKeyNumeric ? [] : {};
      }

      current = current[currentKey];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = flatObject[flatKey];
  }

  return rootObject;
}

function enc(value) {
  if (['null', 'undefined'].indexOf(getType(value)) !== -1) value = '';
  return encodeUriComponent(makeString(value));
}
