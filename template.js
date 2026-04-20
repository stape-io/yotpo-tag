/// <reference path="./server-gtm-sandboxed-apis.d.ts" />

const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getRemoteAddress = require('getRemoteAddress');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const makeTableMap = require('makeTableMap');
const Math = require('Math');
const sendHttpRequest = require('sendHttpRequest');
const templateDataStorage = require('templateDataStorage');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const api = data.apiSelect;
const endpoint = data.coreEndpoint || data.loyaltyEndpoint;
const requestConfig = requestConfigMap(api, endpoint);

if (!requestConfig) return;

sendRequest(api, requestConfig);

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getStoredAuthToken(tokenStorageKey) {
  const storedToken = templateDataStorage.getItemCopy(tokenStorageKey);
  if (storedToken !== null) return storedToken;
}

function generateNewToken(apiSecret, storeId) {
  let accessToken;
  const endpointPath = '/access_tokens';
  const requestBody = JSON.stringify({ secret: apiSecret });
  const generateTokenUrl = 'https://api.yotpo.com/core/v3/stores/' + enc(storeId) + endpointPath;

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
      if (!data.useOptimisticScenario) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          accessToken = responseBody.hasOwnProperty('access_token')
            ? responseBody.access_token
            : null;

          if (accessToken !== null) {
            templateDataStorage.setItemCopy(
              'stape_ytp_token' + (data.coreStoreId || data.loyaltyGUID),
              accessToken
            );
          }
          return accessToken;
        }
      }
    })
    .catch((error) => {
      log({
        Name: 'Yotpo',
        Type: 'Message',
        EventName: 'generate_token',
        Message: 'Token generation failed or timed out',
        Reason: JSON.stringify(error)
      });
      return null;
    });
}

function requestConfigMap(api, endpoint) {
  const coreBaseUrl = 'https://api.yotpo.com/core/v3/stores/' + data.coreStoreId;
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

  if (api === 'core') {
    if (endpoint === 'createOrUpdateCustomer') {
      return {
        baseUrl: coreBaseUrl,
        endpointPath: '/customers',
        body: getCreateOrUpdateCustomerRequestBody,
        options: {
          method: 'PATCH',
          headers: coreAPIHeaders
        }
      };
    }

    if (endpoint === 'createOrder') {
      return {
        baseUrl: coreBaseUrl,
        endpointPath: '/orders',
        body: getCreateOrderRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      };
    }

    if (endpoint === 'createOrderFulfillment') {
      return {
        baseUrl: coreBaseUrl,
        endpointPath: '/orders/' + enc(data.orderId) + '/fulfillments',
        body: getCreateOrderFulfillmentRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      };
    }

    if (endpoint === 'sendAggregatedOrder') {
      return {
        baseUrl: coreBaseUrl,
        endpointPath: '/register_purchase',
        body: getAggregatedOrderRequestBody,
        options: {
          method: 'POST',
          headers: coreAPIHeaders
        }
      };
    }
  }

  if (api === 'loyalty') {
    if (endpoint === 'createLoyaltyCustomer') {
      return {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/customers',
        body: getCreateLoyaltyCustomerRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      };
    }

    if (endpoint === 'createLoyaltyCustomerAction') {
      return {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/actions',
        body: getCreateLoyaltyCustomerActionRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      };
    }
    if (endpoint === 'createLoyaltyOrder') {
      return {
        baseUrl: loyaltyBaseUrl,
        endpointPath: '/orders',
        body: getCreateLoyaltyOrderRequestBody,
        options: {
          method: 'POST',
          headers: loyaltyAPIHeaders
        }
      };
    }
  }
}

function getCreateOrUpdateCustomerRequestBody() {
  let customerProperties = data.createOrUpdateCustomerParameters
    ? makeTableMap(data.createOrUpdateCustomerParameters, 'key', 'value')
    : {};

  const customerCustomProperties = data.createOrUpdateCustomerCustomParameters
    ? makeTableMap(data.createOrUpdateCustomerCustomParameters, 'key', 'value')
    : {};
  customerProperties = convertDotNotationFlatObjectToNestedObject(customerProperties);
  customerProperties['custom_properties'] =
    convertDotNotationFlatObjectToNestedObject(customerCustomProperties);

  if (!customerProperties.ip_address) customerProperties.ip_address = getRemoteAddress();
  if (!customerProperties.user_agent)
    customerProperties.user_agent = getRequestHeader('User-Agent');

  return JSON.stringify(customerProperties);
}

function getCreateOrderRequestBody() {
  let orderProperties = data.createOrderParameters
    ? makeTableMap(data.createOrderParameters, 'key', 'value')
    : {};

  orderProperties = convertDotNotationFlatObjectToNestedObject(orderProperties);
  return JSON.stringify(orderProperties);
}

function getCreateOrderFulfillmentRequestBody() {
  let fulfillmentProperties = data.createOrderFulfillmentParameters
    ? makeTableMap(data.createOrderFulfillmentParameters, 'key', 'value')
    : {};
  fulfillmentProperties = convertDotNotationFlatObjectToNestedObject(fulfillmentProperties);
  return JSON.stringify(fulfillmentProperties);
}

function getAggregatedOrderRequestBody() {
  let orderProperties = data.sendAggregatedOrderParameters
    ? makeTableMap(data.sendAggregatedOrderParameters, 'key', 'value')
    : {};
  orderProperties = convertDotNotationFlatObjectToNestedObject(orderProperties);

  const orderCustomProperties = data.createOrUpdateCustomerCustomParameters
    ? makeTableMap(data.createOrUpdateCustomerCustomParameters, 'key', 'value')
    : {};

  orderProperties['custom_properties'] =
    convertDotNotationFlatObjectToNestedObject(orderCustomProperties);
  return JSON.stringify(orderProperties);
}

function getCreateLoyaltyCustomerRequestBody() {
  let customerProperties = data.createLoyaltyCustomerParameters
    ? makeTableMap(data.createLoyaltyCustomerParameters, 'key', 'value')
    : {};
  customerProperties = convertDotNotationFlatObjectToNestedObject(customerProperties);

  if (!customerProperties.ip_address) customerProperties.ip_address = getRemoteAddress();
  if (!customerProperties.user_agent)
    customerProperties.user_agent = getRequestHeader('User-Agent');

  return JSON.stringify(customerProperties);
}

function getCreateLoyaltyCustomerActionRequestBody() {
  let actionProperties = data.createLoyaltyCustomerActionParameters
    ? makeTableMap(data.createLoyaltyCustomerActionParameters, 'key', 'value')
    : {};
  actionProperties = convertDotNotationFlatObjectToNestedObject(actionProperties);

  if (!actionProperties.ip_address) actionProperties.ip_address = getRemoteAddress();
  if (!actionProperties.user_agent) actionProperties.user_agent = getRequestHeader('User-Agent');

  return JSON.stringify(actionProperties);
}

function getCreateLoyaltyOrderRequestBody() {
  let orderProperties = data.createLoyaltyOrder
    ? makeTableMap(data.createLoyaltyOrder, 'key', 'value')
    : {};
  orderProperties = convertDotNotationFlatObjectToNestedObject(orderProperties);

  if (!orderProperties.ip_address) orderProperties.ip_address = getRemoteAddress();
  if (!orderProperties.user_agent) orderProperties.user_agent = getRequestHeader('User-Agent');

  return JSON.stringify(orderProperties);
}

function sendRequest(api, requestConfig) {
  if (api === 'core') {
    let accessToken = getStoredAuthToken('stape_ytp_token' + data.coreStoreId);
    if (!accessToken) {
      return generateNewToken(data.coreApiSecret, data.coreStoreId).then((accessToken) => {
        return callApi(api, requestConfig, accessToken);
      });
    }
    if (getType(accessToken) === 'string') {
      return callApi(api, requestConfig, accessToken);
    }
  }

  if (api === 'loyalty') {
    return callApi(api, requestConfig);
  }
}

function callApi(api, requestConfig, accessToken, retryTokenGeneratorCounter) {
  retryTokenGeneratorCounter = retryTokenGeneratorCounter || 0;
  if (retryTokenGeneratorCounter > 1) return;
  const url = requestConfig.baseUrl + requestConfig.endpointPath;
  const requestOptions = requestConfig.options;
  const body = requestConfig.body();

  if (api === 'core') {
    requestOptions.headers['X-Yotpo-Token'] = accessToken;
  }

  return sendHttpRequest(url, requestOptions, body)
    .then((response) => {
      if (!data.useOptimisticScenario) {
        if (response.statusCode >= 200 && response.statusCode < 300) return data.gtmOnSuccess();
        else if (response.statusCode === 401 && retryTokenGeneratorCounter < 1) {
          return generateNewToken(data.coreApiSecret, data.coreStoreId).then((newAccessToken) => {
            if (newAccessToken) {
              retryTokenGeneratorCounter++;
              return callApi(api, requestConfig, newAccessToken, retryTokenGeneratorCounter);
            } else {
              return data.gtmOnFailure();
            }
          });
        } else return data.gtmOnFailure();
      }
    })
    .catch((error) => {
      log({
        Name: 'Yotpo',
        Type: 'Message',
        EventName: api + '-' + requestConfig.endpointPath,
        Message: 'API call failed or timed out',
        Reason: JSON.stringify(error)
      });
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

  for (let flatKey in flatObject) {
    const keys = flatKey.split('.');
    let current = rootObject;

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      const nextKey = keys[i + 1];

      if (current[currentKey] === undefined || current[currentKey] === null) {
        const isNextKeyNumeric = nextKey.match('[0-9]+');
        current[currentKey] = isNextKeyNumeric ? [] : {};
      }

      current = current[currentKey];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = flatObject[flatKey];
  }

  return rootObject;
}

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function convertTimestampToISO(timestamp) {
  const leapYear = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const nonLeapYear = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const secToMs = (s) => s * 1000;
  const minToMs = (m) => m * secToMs(60);
  const hoursToMs = (h) => h * minToMs(60);
  const daysToMs = (d) => d * hoursToMs(24);
  const padStart = (value, length) => {
    let result = makeString(value);
    while (result.length < length) {
      result = '0' + result;
    }
    return result;
  };

  const fourYearsInMs = daysToMs(365 * 4 + 1);
  let year = 1970 + Math.floor(timestamp / fourYearsInMs) * 4;
  timestamp = timestamp % fourYearsInMs;

  while (true) {
    let isLeapYear = year % 4 === 0;
    let nextTimestamp = timestamp - daysToMs(isLeapYear ? 366 : 365);
    if (nextTimestamp < 0) {
      break;
    }
    timestamp = nextTimestamp;
    year = year + 1;
  }

  const daysByMonth = year % 4 === 0 ? leapYear : nonLeapYear;

  let month = 0;
  for (let i = 0; i < daysByMonth.length; i++) {
    const msInThisMonth = daysToMs(daysByMonth[i]);
    if (timestamp > msInThisMonth) {
      timestamp = timestamp - msInThisMonth;
    } else {
      month = i + 1;
      break;
    }
  }

  const date = Math.ceil(timestamp / daysToMs(1));
  timestamp = timestamp - daysToMs(date - 1);
  const hours = Math.floor(timestamp / hoursToMs(1));
  timestamp = timestamp - hoursToMs(hours);
  const minutes = Math.floor(timestamp / minToMs(1));
  timestamp = timestamp - minToMs(minutes);
  const sec = Math.floor(timestamp / secToMs(1));
  timestamp = timestamp - secToMs(sec);
  const milliSeconds = timestamp;

  return (
    year +
    '-' +
    padStart(month, 2) +
    '-' +
    padStart(date, 2) +
    'T' +
    padStart(hours, 2) +
    ':' +
    padStart(minutes, 2) +
    ':' +
    padStart(sec, 2) +
    '.' +
    padStart(milliSeconds, 3) +
    'Z'
  );
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
