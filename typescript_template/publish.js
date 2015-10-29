// Derived from JsDoc Toolkit default template.

/**
 * The entry point.
 *
 * generates the kii.d.ts.
 */
function publish(symbolSet) {
    function isaClass($) {
        return ($.is("CONSTRUCTOR") || $.isNamespace) && $.alias != "_global_";
    }

    var symbols = symbolSet.toArray();
    var classes = symbols.filter(isaClass).sort(makeSortBy("alias"));

    for (var classSymbol of classes) {
        classSymbol.methods = classSymbol.methods.map(function (method) {
            // apply ad-hoc tweaks
            method = fixCallbacksParameter(classSymbol, method);
            method = normalizePrimitives(method);
            method = overrideMethodTypeParams(classSymbol, method);
            method = overrideMethodParamTypes(classSymbol, method);
            method = overrideMethodReturnType(classSymbol, method);
            method = overrideVariadicParams(classSymbol, method);
            method = fixOptionalParameters(method);
            method = fixThingFields(method);
            method = fixIdentityData(method);

            return method;
        });

        classSymbol.properties = classSymbol.properties.map(function (property) {
            return overridePropertyType(classSymbol, property);
        });
    }

    var outputText = format(classes);

    var outDir = JSDOC.opt.d || SYS.pwd + "../out/jsdoc/";

    IO.saveFile(outDir, "kii.d.ts", outputText);
}

/**
 * Types for the parameters of callback methods.
 */
var callbackParamTypes = {
    'addMembersArray': 'KiiUser[]',
    'adminContext': 'KiiAppAdminContext',
    'anErrorString': 'string',
    'argument': 'T',
    'bodyBlob': 'Blob',
    'bucket': 'KiiBucket',
    'bucketToDelete': 'KiiBucket',
    'count': 'number',
    'deletedBucket': 'KiiBucket',
    'entry': 'KiiServerCodeEntry',
    'errString': 'string',
    'error': function (classSymbol, method, callbackName, callbackParams) {
        // ad-hoc fix for authenticateAsAppAdmin

        if (callbackParams.length == 1) {
            return 'Error';
        } else {
            return "string";
        }
    },
    'errorString': 'string',
    'execResult': 'KiiServerCodeExecResult',
    'existed': 'boolean',
    'group': function (classSymbol, method, callbackName, callbackParams) {
        if (classSymbol.name == "KiiThing" && method.name == "registerOwner" || "unregisterOwner") {
            return "T";
        } else {
            return 'KiiGroup';
        }
    },
    'groupList': 'KiiGroup[]',
    'isOwner': 'boolean',
    'isSubscribed': 'boolean',
    'memberList': 'KiiUser[]',
    'message': 'T',
    'network': 'KiiSocialNetworkName',
    'nextPaginationKey': 'string',
    'nextQuery': 'KiiQuery',
    'obj': 'KiiObject',
    'publishedUrl': 'string',
    'query': 'KiiQuery',
    'queryPerformed': 'KiiQuery',
    'removeMembersArray': 'KiiUser[]',
    'resultSet': 'T[]',
    'statusCode': 'number',
    'subscription': 'KiiPushSubscription',
    'theACL': 'KiiACL',
    'theAuthenticatedUser': 'KiiUser',
    'theDeletedGroup': 'KiiGroup',
    'theDeletedObject': 'KiiObject',
    'theDeletedUser': 'KiiUser',
    'theEntries': 'KiiACLEntry[]',
    'theGroup': 'KiiGroup',
    'theMatchedUser': 'KiiUser',
    'theObject': 'KiiObject',
    'theOwner': 'KiiUser',
    'theRefreshedGroup': 'KiiGroup',
    'theRefreshedObject': 'KiiObject',
    'theRefreshedUser': 'KiiUser',
    'theRenamedGroup': 'KiiGroup',
    'theSavedACL': 'KiiACL',
    'theSavedGroup': 'KiiGroup',
    'theSavedObject': 'KiiObject',
    'theSavedUser': 'KiiUser',
    'theSrcObject': 'KiiObject',
    'theTgtObjectUri': 'string',
    'theUser': 'KiiUser',
    'thing': 'KiiThing',
    'topic': function (classSymbol, method, callbackName, callbackParams) {
        if (classSymbol.name == "KiiPushSubscription") {
            return "T";
        } else {
            return 'KiiTopic';
        }
    },
    'topicList': 'KiiTopic[]',
    'user': function (classSymbol, method, callbackName, callbackParams) {
        if (classSymbol.name == "KiiThing" && method.name == "isOwner") {
            return "T";
        } else {
            return 'KiiUser';
        }
    }
};

/**
 * Types of method parameters.
 */
var methodParamTypeOverrides = {
    "Kii": {
        "setAccessTokenExpiration": {
            "expiresIn": "number"
        },

        "groupWithNameAndMembers": {
            "members": "KiiUser[]"
        }
    },
    "KiiACLEntry": {
        "setSubject": {
            "subject": "KiiACLSubject"
        },
        "entryWithSubject": {
            "Subject": "KiiACLSubject"
        }
    },
    "KiiAnalytics": {
        "initializeWithSite": {
            "deviceid": "string"
        },
        "initialize": {
            "deviceid": "string"
        },
        "trackEventWithExtrasAndCallbacks": {
            "callbacks": "{ success(): void; failure(error: Error): void; }"
        }
    },
    "KiiAppAdminContext": {
        "registerThing": {
            "fields": "KiiThingFields"
        },
        "findUserByEmail": {
            "callbacks": "{ success(adminContext: KiiAppAdminContext, theMatchedUser: KiiUser): void; failure(adminContext: KiiAppAdminContext, anErrorString: string): void; }"
        },
        "findUserByPhone": {
            "callbacks": "{ success(adminContext: KiiAppAdminContext, theMatchedUser: KiiUser): void; failure(adminContext: KiiAppAdminContext, anErrorString: string): void; }"
        },
        "findUserByUsername": {
            "callbacks": "{ success(adminContext: KiiAppAdminContext, theMatchedUser: KiiUser): void; failure(adminContext: KiiAppAdminContext, anErrorString: string): void; }"
        }
    },
    "KiiClause": {
        "and": {
            "A": "KiiClause[]"
        },
        "or": {
            "A": "KiiClause[]"
        },
        "inClause": {
            "values": "any[]"
        }
    },
    "KiiGroup": {
        "groupWithNameAndMembers": {
            "members": "KiiUser[]"
        },
        "groupWithID": {
            "groupId": "string"
        }
    },
    "KiiObject": {
        "saveAllFields": {
            "overwrite": "boolean"
        },
        "save": {
            "overwrite": "boolean"
        }
    },
    "KiiPushMessageBuilder": {
        "apnsAlert": {
            "alert": "string | APNSAlert"
        },
        "gcmData": {
            "data": "{ [key: string]: string }"
        },
        "apnsData": {
            "data": "{ [key: string]: string | number | boolean }"
        },
        "jpushData": {
            "data": "{ [name: string]: string | number | boolean }"
        },
        "mqttData": {
            "data": "{ [key: string]: string }"
        }
    },
    "KiiPushSubscription": {
        "subscribe": {
            "target": "T"
        },
        "isSubscribed": {
            "target": "T"
        },
        "unsubscribe": {
            "target": "T"
        }
    },
    "KiiQuery": {
        "setLimit": {
            "value": "number"
        },
        "queryWithClause": {
            "clause": "KiiClause"
        }
    },
    "KiiServerCodeEntry": {
        "execute": {
            "argument": "T"
        }
    },
    "KiiSocialConnect": {
        "logIn": {
            "networkName": "KiiSocialNetworkName",
            "options": "KiiSocialConnectOptions"
        },
        "linkCurrentUserWithNetwork": {
            "networkName": "KiiSocialNetworkName",
            "options": "KiiSocialConnectOptions"
        },
        "unLinkCurrentUserFromNetwork": {
            "networkName": "KiiSocialNetworkName"
        },
        "getAccessTokenForNetwork": {
            "networkName": "KiiSocialNetworkName"
        },
        "getAccessTokenExpirationForNetwork": {
            "networkName": "KiiSocialNetworkName"
        },
        "getAccessTokenObjectForNetwork": {
            "networkName": "KiiSocialNetworkName"
        }
    },
    "KiiThing": {
        "isOwner": {
            "owner": "T"
        },
        "registerOwner": {
            "owner": "T"
        },
        "unregisterOwner": {
            "owner": "T"
        }
    },
    "KiiTopic": {
        "sendMessage": {
            "message": "T"
        }
    },
    "KiiUser": {
        "putIdentity": {
            "password": "string",
            "removeFields": "string[]"
        },
        "update": {
            "removeFields": "string[]"
        },
        "userWithUsername": {
            "username": "string",
            "password": "string"
        },
        "userWithPhoneNumber": {
            "phoneNumber": "string",
            "password": "string"
        },
        "userWithPhoneNumberAndUsername": {
            "phoneNumber": "string",
            "username": "string",
            "password": "string"
        },
        "userWithEmailAddress": {
            "emailAddress": "string",
            "password": "string"
        },
        "userWithEmailAddressAndPhoneNumber": {
            "emailAddress": "string",
            "phoneNumber": "string",
            "password": "string"
        },
        "userWithEmailAddressAndUsername": {
            "emailAddress": "string",
            "username": "string",
            "password": "string"
        },
        "userWithCredentials": {
            "emailAddress": "string",
            "phoneNumber": "string",
            "username": "string",
            "password": "string"
        },
        "userWithID": {
            "userID": "string"
        }
    }
};

/**
 * Return types of methods.
 */
var methodReturnTypeOverrides = {
    "Kii": {
        "getAccessTokenExpiration": "number",
        "encryptedBucketWithName": "KiiBucket"
    },
    "KiiACLEntry": {
        "getSubject": "T",
        "entryWithSubject": "KiiACLEntry"
    },
    "KiiAnalytics": {
        "trackEvent": "Promise<void>",
        "trackEventWithExtras": "Promise<void>"
    },
    "KiiAppAdminContext": {
        "findUserByEmail": "Promise<[KiiAppAdminContext, KiiUser]>",
        "findUserByPhone": "Promise<[KiiAppAdminContext, KiiUser]>",
        "findUserByUsername": "Promise<[KiiAppAdminContext, KiiUser]>"
    },
    "KiiAnonymousUser": {
        "getID": "string"
    },
    "KiiAnyAuthenticatedUser": {
        "getID": "string"
    },
    "KiiBucket": {
        "createObjectWithType": "KiiObject"
    },
    "KiiClause": {
        "and": "KiiClause",
        "or": "KiiClause",
        "equals": "KiiClause",
        "notEquals": "KiiClause",
        "greaterThan": "KiiClause",
        "greaterThanOrEqual": "KiiClause",
        "lessThan": "KiiClause",
        "lessThanOrEqual": "KiiClause",
        "inClause": "KiiClause",
        "startsWith": "KiiClause"
    },
    "KiiGeoPoint": {
        "getLatitude": "number",
        "getLongitude": "number"
    },
    "KiiGroup": {
        "encryptedBucketWithName": "KiiBucket",
        "groupWithID": "KiiGroup"
    },
    "KiiObject": {
        "get": "T",
        "getCreated": "number",
        "isValidObjectID": "boolean"
    },
    "KiiPushMessageBuilder": {
        "setSendToDevelopment": "KiiPushMessageBuilder",
        "setSendToProduction": "KiiPushMessageBuilder",
        "enableGcm": "KiiPushMessageBuilder",
        "enableApns": "KiiPushMessageBuilder",
        "enableJpush": "KiiPushMessageBuilder",
        "enableMqtt": "KiiPushMessageBuilder",
        "gcmData": "KiiPushMessageBuilder",
        "gcmCollapseKey": "KiiPushMessageBuilder",
        "gcmDelayWhileIdle": "KiiPushMessageBuilder",
        "gcmTimeToLive": "KiiPushMessageBuilder",
        "gcmRestrictedPackageName": "KiiPushMessageBuilder",
        "apnsData": "KiiPushMessageBuilder",
        "apnsAlert": "KiiPushMessageBuilder",
        "apnsSound": "KiiPushMessageBuilder",
        "apnsBadge": "KiiPushMessageBuilder",
        "apnsContentAvailable": "KiiPushMessageBuilder",
        "apnsCategory": "KiiPushMessageBuilder",
        "jpushData": "KiiPushMessageBuilder",
        "mqttData": "KiiPushMessageBuilder"
    },
    "KiiQuery": {
        "queryWithClause": "KiiQuery"
    },
    "KiiUser": {
        "userWithUsername": "KiiUser",
        "encryptedBucketWithName": "KiiBucket",
        "getLinkedSocialAccounts": "{ [name: string]: KiiSocialAccountInfo }",
        "getAccessTokenObject": "{ access_token: string, expires_at: Date }",
        "get": "T",
        "userWithUsername": "KiiUser",
        "userWithPhoneNumber": "KiiUser",
        "userWithPhoneNumberAndUsername": "KiiUser",
        "userWithEmailAddress": "KiiUser",
        "userWithEmailAddressAndUsername": "KiiUser",
        "userWithEmailAddressAndPhoneNumber": "KiiUser",
        "userWithCredentials": "KiiUser",
        "userWithID": "KiiUser",
        "loggedIn": "boolean"
    }
};

/**
 * Type parameters of methods.
 */
var methodTypeParamsOverrides = {
    "KiiBucket": {
        "executeQuery": ["T"]
    },
    "KiiACLEntry": {
        "getSubject": ["T extends KiiACLSubject"]
    },
    "KiiObject": {
        "get": ["T"]
    },
    "KiiServerCodeEntry": {
        "execute": ["T"]
    },
    "KiiPushSubscription": {
        "subscribe": ["T extends KiiBucket | KiiTopic"],
        "isSubscribed": ["T extends KiiBucket | KiiTopic"],
        "unsubscribe": ["T extends KiiBucket | KiiTopic"]
    },
    "KiiThing": {
        "isOwner": ["T extends KiiUser | KiiGroup"],
        "registerOwner": ["T extends KiiUser | KiiGroup"],
        "unregisterOwner": ["T extends KiiUser | KiiGroup"]
    },
    "KiiTopic": {
        "sendMessage": ["T"]
    },
    "KiiUser": {
        "get": ["T"]
    }
};

/**
 * Variadic method parameters.
 */
var variadicParamOverrides = {
    "KiiClause": {
        "and": ["A"],
        "or": ["A"]
    }
};

/**
 * Types of properties.
 */
var propertyTypeOverrides = {
    "KiiThing": {
        "fields": "KiiThingFields"
    }
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
// public domain: https://developer.mozilla.org/en-US/docs/MDN/About#Copyrights_and_licenses
if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
// public domain: https://developer.mozilla.org/en-US/docs/MDN/About#Copyrights_and_licenses
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.findIndex called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

function makeSortBy(attribute) {
    return function(a, b) {
        if (a[attribute] != undefined && b[attribute] != undefined) {
            a = a[attribute].toLowerCase();
            b = b[attribute].toLowerCase();
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        } else {
            return 0;
        }
    };
}

/**
 * guesses and updates types of `callbacks` parameters from code examples.
 */
function fixCallbacksParameter(classSymbol, method) {
    method._params = method.params.filter(function (param) {
        return param.name != "callbacks.success" &&
            param.name != "callbacks.failure";
    });

    var callbackParam = method.params.find(function (param) {
        return param.name == "callbacks";
    });

    /**
     * extracts parameter names of a callback method from code examples.
     */
    function extractParams(pattern, callbackName) {
        var params = [];

        for (var example of method.example) {
            var match = example.desc.match(pattern);

            if (!match || match[1] == "") {
                continue;
            }

            params = match[1].split(/, */);
            params = params.map(function (param) {
                var type = callbackParamTypes[param];

                if (typeof type == "function") {
                    type = type(classSymbol, method, callbackName, params);
                }

                return {
                    name: param,
                    type: type
                };
            });
        }

        return params;
    }

    function formatParams(params) {
        return params.map(function (param) {
            return param.name + ": " + param.type;
        }).join(", ");
    }

    if (callbackParam) {
        var successParams =
                extractParams(/success: function\(([^)]*)\)/, "success");
        var failureParams =
                extractParams(/failure: function\(([^)]*)\)/, "failure");
        var successParamsString = formatParams(successParams);
        var failureParamsString = formatParams(failureParams);

        callbackParam.type =
            "{ success(" + successParamsString + "): void;" +
            " failure(" + failureParamsString + "): void; }";

        callbackParam.isOptional = true;

        if (successParams.length == 0) {
            method.type = "Promise<void>";
        } else if (successParams.length == 1) {
            method.type = "Promise<" + successParams[0].type + ">";
        } else {
            var paramTypesString = successParams.map(function (param) {
                return param.type;
            }).join(", ");

            method.type = "Promise<[" + paramTypesString + "]>";
        }
    }

    return method;
}

/**
 * translates type names from JsDoc to TypeScript.
 */
function normalizePrimitives(method) {
    var primitives = {
        "String": "string",
        "Integer": "number",
        "Number": "number",
        "Boolean": "boolean",
        "Object": "any"
    };

    method.type = primitives[method.type] || method.type;

    for (var param of method.params) {
        param.type = primitives[param.type] || param.type;
    }

    return method;
}

/**
 * looks up the given table with the class name and the method name.
 */
function lookupClassMemberOverrides(classSymbol, method, map) {
    var mapForClass = map[classSymbol.name] || {};

    return mapForClass[method.name];
}

/**
 * overrides the type parameters of the given method.
 */
function overrideMethodTypeParams(classSymbol, method) {
    var overrides =
            lookupClassMemberOverrides(classSymbol,
                                       method,
                                       methodTypeParamsOverrides);

    if (overrides) {
        method.typeParams = overrides;
    }

    return method;
}

/**
 * overrides the types of the parameters.
 */
function overrideMethodParamTypes(classSymbol, method) {
    var overrides =
            lookupClassMemberOverrides(classSymbol,
                                       method,
                                       methodParamTypeOverrides);

    if (overrides) {
        for (var param of method.params) {
            if (overrides[param.name]) {
                param.type = overrides[param.name];
            }
        }
    }

    return method;
}

/**
 * overrides the return type of the given method.
 */
function overrideMethodReturnType(classSymbol, method) {
    return overrideType(classSymbol, method, methodReturnTypeOverrides);
}

/**
 * overrides the type of the given property.
 */
function overridePropertyType(classSymbol, property) {
    return overrideType(classSymbol, property, propertyTypeOverrides);
}

/**
 * A support function for overrideMethodReturnType and overridePropertyType.
 */
function overrideType(classSymbol, symbol, overrides) {
    var type = lookupClassMemberOverrides(classSymbol, symbol, overrides);

    if (type) {
        symbol.type = type;
    }

    return symbol;
}

/**
 * marks some parameters as a variadic parameters.
 */
function overrideVariadicParams(classSymbol, method) {
    var overrides =
            lookupClassMemberOverrides(classSymbol,
                                       method,
                                       variadicParamOverrides);

    if (overrides) {
        for (var param of method.params) {
            if (overrides.indexOf(param.name) >= 0) {
                param.isVariadic = true;
            }
        }
    }

    return method;
}

/**
 * tweaks the `fileds` parameters of KiiThings.
 */
function fixThingFields(method) {
    var hasThingFields = method.params.find(function (param) {
        return param.name == "fields._vendorThingID";
    });

    if (!hasThingFields) {
        return method;
    }

    method._params = method.params.filter(function (param) {
        return !param.name.match(/^fields\./);
    });

    var fieldsParam = method.params.find(function (param) {
        return param.name == "fields";
    });

    fieldsParam.type = "KiiThingFields";

    return method;
}

/**
 * tweaks the `identityData` parameters of KiiUser.
 */
function fixIdentityData(method) {
    var identityDataParam = method.params.find(function (param) {
        return param.name == "identityData";
    });

    if (!identityDataParam) {
        return method;
    }

    method._params = method.params.filter(function (param) {
        return !param.name.match(/^identityData\./);
    });

    identityDataParam.type =
        "{ emailAddress?: string, phoneNumber?: string, username?: string }";

    return method;
}

/**
 * overrides some parameters to be optional.
 */
function fixOptionalParameters(method) {
    var optinalIndex = method.params.findIndex(function(param) {
        return param.isOptional;
    });

    if (optinalIndex >= 0) {
        for (var i = optinalIndex + 1; i < method.params.length; i++) {
            method.params[i].isOptional = true;
        }
    }

    return method;
}

/**
 * formats classes as a type definitions and return d.ts text.
 */
function format(classes) {
    var output = [];

    output.push("// Type definitions for Kii Cloud SDK\n");
    output.push("// Project: http://en.kii.com/\n");
    output.push("// Definitions by: Kii Consortium <http://jp.kii.com/consortium/>\n");
    output.push("\n");

    output.push("/// <reference path='../es6-promise/es6-promise.d.ts' />\n");
    output.push("\n");

    output.push("declare module KiiCloud {\n");

    output.push("  enum KiiACLAction {\n");
    output.push("    KiiACLBucketActionCreateObjects,\n");
    output.push("    KiiACLBucketActionQueryObjects,\n");
    output.push("    KiiACLBucketActionDropBucket,\n");
    output.push("    KiiACLObjectActionRead,\n");
    output.push("    KiiACLObjectActionWrite,\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  export enum KiiSite {\n");
    output.push("    US,\n");
    output.push("    JP,\n");
    output.push("    CN,\n");
    output.push("    SG,\n");
    output.push("    CN3\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  export enum KiiAnalyticsSite {\n");
    output.push("    US,\n");
    output.push("    JP,\n");
    output.push("    CN,\n");
    output.push("    SG,\n");
    output.push("    CN3\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  enum KiiSocialNetworkName {\n");
    output.push("    FACEBOOK = 1,\n");
    output.push("    TWITTER = 2,\n");
    output.push("    QQ = 3,\n");
    output.push("    GOOGLEPLUS = 4,\n");
    output.push("    RENREN = 5\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  type KiiSocialConnectOptions = {\n");
    output.push("      access_token: string,\n");
    output.push("      openID?: string\n");
    output.push("  } | {\n");
    output.push("      oauth_token: string,\n");
    output.push("      oauth_token_secret: string\n");
    output.push("  };\n");
    output.push("\n");

    output.push("  interface KiiSocialAccountInfo {\n");
    output.push("    createdAt: number;\n");
    output.push("    provider: KiiSocialNetworkName;\n");
    output.push("    socialAccountId: string;\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  interface KiiThingFields {\n");
    output.push("    /**\n");
    output.push("     * thing identifier given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _vendorThingID: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * thing password given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _password: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * thing type given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _thingType?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * vendor identifier given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _vendor?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * firmware version given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _firmwareVersion?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * lot identifier given by thing vendor.\n");
    output.push("     */\n");
    output.push("    _lot?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary string field.\n");
    output.push("     */\n");
    output.push("    _stringField1?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary string field.\n");
    output.push("     */\n");
    output.push("    _stringField2?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary string field.\n");
    output.push("     */\n");
    output.push("    _stringField3?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary string field.\n");
    output.push("     */\n");
    output.push("    _stringField4?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary string field.\n");
    output.push("     */\n");
    output.push("    _stringField5?: string;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary number field.\n");
    output.push("     */\n");
    output.push("    _numberField1?: number;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary number field.\n");
    output.push("     */\n");
    output.push("    _numberField2?: number;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary number field.\n");
    output.push("     */\n");
    output.push("    _numberField3?: number;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary number field.\n");
    output.push("     */\n");
    output.push("    _numberField4?: number;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * arbitrary number field.\n");
    output.push("     */\n");
    output.push("    _numberField5?: number;\n");
    output.push("\n");
    output.push("    /**\n");
    output.push("     * custom fields.\n");
    output.push("     */\n");
    output.push("    [name: string]: any;\n");
    output.push("  }\n");
    output.push("\n");

    output.push("  type KiiACLSubject =\n");
    output.push("    KiiGroup |\n");
    output.push("    KiiUser |\n");
    output.push("    KiiAnyAuthenticatedUser |\n");
    output.push("    KiiAnonymousUser |\n");
    output.push("    KiiThing;\n");
    output.push("\n");

    output.push('  interface APNSAlert {\n');
    output.push('    title: string;\n');
    output.push('    body: string;\n');
    output.push('    "title-loc-key": string;\n');
    output.push('    "title-loc-args": string[];\n');
    output.push('    "action-loc-key": string;\n');
    output.push('    "loc-key": string;\n');
    output.push('    "loc-args": string[];\n');
    output.push('    "launch-image": string;\n');
    output.push('  }\n');
    output.push('\n');

    classes.forEach(function (classSymbol) {
        formatClass(classSymbol, output);
        output.push("\n");
    });

    if (classes.length > 0) {
        output.pop();
    }

    output.push("}\n");
    output.push("\n");

    output.push("import KiiACLAction = KiiCloud.KiiACLAction;\n");
    output.push("import KiiSite = KiiCloud.KiiSite;\n");
    output.push("import KiiAnalyticsSite = KiiCloud.KiiAnalyticsSite;\n");
    output.push("import KiiSocialNetworkName = KiiCloud.KiiSocialNetworkName;\n");

    classes.forEach(function (classSymbol) {
        output.push("import " + classSymbol.name + " = KiiCloud." + classSymbol.name + ";\n");
    });

    return output.join("");
}

/**
 * formats a classe into the buffer.
 */
function formatClass(classSymbol, output) {
    output.push("  /**\n");
    output.push(classSymbol.classDesc.replace(/^(    )?/gm, "   * "));
    output.push("\n");
    output.push("   */\n");

    output.push("  export class " + classSymbol.name + " {\n");

    classSymbol.properties.forEach(function (property) {
        formatProperty(property, output);
        output.push("\n");
    });

    classSymbol.methods.forEach(function (method) {
        formatMethod(classSymbol, method, output);
        output.push("\n");
    });

    if (classSymbol.methods.length > 0) {
        output.pop();
    }

    output.push("  }\n");
}

/**
 * formats a property into the buffer.
 */
function formatProperty(property, output) {
    output.push("    /**\n");
    output.push(property.desc.replace(/^(  )?/gm, "     * "));
    output.push("\n");
    output.push("     */\n");
    output.push("    " + property.name + ": " + (property.type || "any") + ";\n");
}

/**
 * formats a method into the buffer.
 */
function formatMethod(classSymbol, method, output) {
    // JsDoc comments

    output.push("    /**\n");
    output.push(method.desc.replace(/^(  )?/gm, "     * "));
    output.push("\n");

    if (method.deprecated) {
        output.push("     *\n");

        output.push("     * @deprecated ");
        output.push(method.deprecated.replace(/\n */gm, "\n     *   "));
        output.push("\n");
    }

    if (method.params.length > 0) {
        output.push("     *\n");

        method.params.forEach(function (param) {
            output.push("     * @param " + param.name + " ");
            output.push(param.desc.replace(/\n */gm, "\n     *   "));
            output.push("\n");
        });
    }

    if (method.returns.length > 0) {
        output.push("     *\n");

        method.returns.forEach(function (ret) {
            output.push("     * @return ");
            output.push(ret.desc.replace(/\n(    )?/gm, "\n     *   "));
            output.push("\n");
        });
    }

    if (method.exceptions.length > 0) {
        output.push("     *\n");

        method.exceptions.forEach(function (exception) {
            output.push("     * @throws ");
            output.push(exception.desc.replace(/\n(    )?/gm, "\n     *   "));
            output.push("\n");
        });
    }

    if (method.see.length > 0) {
        output.push("     *\n");

        method.see.forEach(function (see) {
            output.push("     * @see " + see + "\n");
        });
    }

    if (method.example.length > 0) {
        output.push("     *\n");

        method.example.forEach(function (example) {
            output.push("     * @example\n");
            output.push(example.desc.replace(/^/gm, "     *   "));
            output.push("\n");
        });
    }

    output.push("     */\n");

    // method declaration

    var isConstructor = classSymbol.name == method.name;

    var name = isConstructor ? "constructor" : method.name;

    output.push("    " + (method.isStatic ? "static " : "") + name);

    if (method.typeParams) {
        output.push("<");
        for (var typeParam of method.typeParams) {
            output.push(typeParam);

            output.push(", ");
        }
        output.pop();
        output.push(">");
    }

    output.push("(");

    method.params.forEach(function (param) {
        formatParam(param, output);
        output.push(", ");
    });

    if (method.params.length > 0) {
        output.pop();
    }

    if (isConstructor) {
        output.push(");\n");
    } else {
        output.push("): " + (method.type || "void") + ";\n");
    }
}

/**
 * formats a parameter of a method into the buffer.
 */
function formatParam(param, output) {
    if (param.isVariadic) {
        output.push("...");
    }

    output.push(param.name);

    if (param.isOptional) {
        output.push("?");
    }

    output.push(": ");
    output.push(param.type || "any");
}
