// Copyright © 2015 Kii Consortium.
// JsDoc Toolkit is Copyright (c)2009 Michael Mathews <micmath@gmail.com>
// MIT Licensed, see LICENSE.md for details.

// Derived from JsDoc Toolkit default template.

/**
 * The entry point.
 *
 * generates the kii-cloud-sdk.d.ts.
 */
function publish(symbolSet) {
    function isaClass($) {
        return ($.is("CONSTRUCTOR") || $.isNamespace) && $.alias != "_global_";
    }

    try {
        var symbols = symbolSet.toArray();
        var classes = symbols.filter(isaClass).sort(makeSortBy("alias"));

        for (var classSymbol of classes) {
            classSymbol.methods = classSymbol.methods.map(function (method) {
                // apply ad-hoc tweaks
                method = fixCallbacksParameter(classSymbol, method);
                method = overrideMethodTypeParams(classSymbol, method);
                method = overrideMethodParamTypes(classSymbol, method);
                method = overrideReturnType(classSymbol, method);
                method = overrideVariadicParams(classSymbol, method);
                method = fixOptionalParameters(method);
                method = fixThingFields(method);
                method = fixIdentityData(method);

                resolveReferencingType(method.type, method);

                method.params.forEach(function (param) {
                    resolveReferencingType(param.type, method);
                });

                method = normalizePrimitives(method);

                method = overrideTernEffects(classSymbol, method);
                addTernEffectsForCallbacks(classSymbol, method);

                return method;
            });

            classSymbol.properties = classSymbol.properties.map(function (property) {
                return overrideReturnType(classSymbol, property);
            });
        }

        // output TypeScript .d.ts file

        var outputText = format(classes);

        var outDir = JSDOC.opt.d || SYS.pwd + "../out/jsdoc/";

        var outFile = "kii-cloud-sdk-" + (process.env.KII_VERSION || "") + ".d.ts";

        IO.saveFile(outDir, outFile, outputText);

        // output type definitions for Tern

        classes.forEach(function (classSymbol) {
            classSymbol.methods.forEach(function (method) {
                method.params.forEach(function (param) {
                    if (param.type.getTernCallbackType) {
                        ternTypeAliases[param.type.getTernCallbackTypeName()] =
                            param.type.getTernCallbackType();
                    }
                });
            });
        });

        var jsonFile = "kii-cloud-sdk-" + (process.env.KII_VERSION || "") + ".json";

        IO.saveFile(outDir, jsonFile,
                    JSON.stringify(buildTernJSONTypeDefinitions(classes),
                                   null,
                                   2));
    } catch (e) {
        console.error(e.stack);

        throw e;
    }
}

// type objects

/**
 * formats a (TypeScript) type as a Tern type.
 */
function formatTernType(type) {
    if (!type) {
        return String(type);
    } if (type.formatTernType) {
        return type.formatTernType();
    } else {
        var typeName = String(type);

        if (typeName == "any") {
            return "?";
        } else if (typeName == "boolean") {
            return "bool";
        } else if (typeName.match(/^[A-Z]/) && !ternTypeAliases[typeName]) {
            return "+" + typeName;
        } else {
            return typeName;
        }
    }
}

/**
 * resolves referencing type to actual type.
 */
function resolveReferencingType(type, method) {
    if (type && type.resolveReferencingType) {
        type.resolveReferencingType(method);
    }
}

/**
 * The type of arrays (Foo[] for TypeScript, [Foo] for Tern).
 */
function ArrayType(elementType) {
    if (this instanceof ArrayType) {
        this.elementType = elementType;

        return this;
    } else {
        return new ArrayType(elementType);
    }
}

/**
 * formats this type as a TypeScript type.
 */
ArrayType.prototype.toString = function() {
    return this.elementType + "[]";
};

/**
 * formats this type as a Tern type.
 */
ArrayType.prototype.formatTernType = function() {
    return "[" + formatTernType(this.elementType) + "]";
};

/**
 * resolves referencing types contained in this type.
 */
ArrayType.prototype.resolveReferencingType = function(method) {
    resolveReferencingType(this.elementType, method);
};

/**
 * The type of Promise.
 *
 * Promise<[type1, type2, ...]> for TypeScript.
 * Promise[:t=[type1, type2, ...]] for Tern.
 */
function PromiseType(elementTypes) {
    if (this instanceof PromiseType) {
        this.elementTypes = Array.apply([], arguments);

        return this;
    } else {
        var type = new PromiseType();

        return PromiseType.apply(type, arguments) || type;
    }
}

/**
 * formats this type as a TypeScript type.
 */
PromiseType.prototype.toString = function() {
    if (this.elementTypes.length == 0) {
        return "Promise<void>";
    } else if (this.elementTypes.length == 1) {
        return "Promise<" + this.elementTypes[0] + ">";
    } else {
        return "Promise<[" + this.elementTypes.join(", ") + "]>";
    }
};

/**
 * formats this type as a Tern type.
 */
PromiseType.prototype.formatTernType = function() {
    if (this.elementTypes.length == 0) {
        return "+Promise";
    } else if (this.elementTypes.length == 1) {
        return "+Promise[:t=" + formatTernType(this.elementTypes[0]) + "]";
    } else {
        var elementTypes = this.elementTypes.map(formatTernType).join(", ");

        return "+Promise[:t=[" + elementTypes + "]]";
    }
};

/**
 * resolves referencing types contained in this type.
 */
PromiseType.prototype.resolveReferencingType = function(method) {
    this.elementTypes.forEach(function (type) {
        resolveReferencingType(type, method);
    });
};

/**
 * The type of callback functions.
 *
 * { success(t1, t2, ...): any; failure(s1, s2, ...): any } for TypeScript.
 * { success: fn(t1, t2, ...); failure: fn(s1, s2, ...) } for Tern.
 */
function CallbackType(className, methodName, successParams, failureParams) {
    if (this instanceof CallbackType) {
        this.className = className;
        this.methodName = methodName;
        this.successParams = successParams;
        this.failureParams = failureParams;

        return this;
    } else {
        return new CallbackType(className, methodName, successParams, failureParams);
    }
}

/**
 * formats this type as a TypeScript type.
 */
CallbackType.prototype.toString = function() {
    function formatParams(params) {
        return params.map(function (param) {
            return param.name + ": " + param.type;
        }).join(", ");
    }

    var successParamsString = formatParams(this.successParams);
    var failureParamsString = formatParams(this.failureParams);

    return "{ success(" + successParamsString + "): any; failure(" + failureParamsString + "): any; }";
};

/**
 * formats this type as a Tern type.
 */
CallbackType.prototype.formatTernType = function() {
    return this.getTernCallbackTypeName();
};

/**
 * Returns type name for this type.
 *
 * We cannot embed object types directly to other types, so that we have to
 * name them in "!define".
 */
CallbackType.prototype.getTernCallbackTypeName = function() {
    return this.className + "." + this.methodName + ".callbacks";
};

/**
 * Returns actual type definition for "!define".
 */
CallbackType.prototype.getTernCallbackType = function() {
    function formatParams(params) {
        return params.map(function (param) {
            return param.name + ": " + formatTernType(param.type);
        }).join(", ");
    }

    var successParamsString = formatParams(this.successParams);
    var failureParamsString = formatParams(this.failureParams);

    return {
        success: "fn(" + successParamsString + ")",
        failure: "fn(" + failureParamsString + ")"
    };
};

/**
 * resolves referencing types contained in this type.
 */
CallbackType.prototype.resolveReferencingType = function(method) {
    this.successParams.forEach(function (param) {
        resolveReferencingType(param.type, method);
    });

    this.failureParams.forEach(function (param) {
        resolveReferencingType(param.type, method);
    });
};

/**
 * The type that is different for TypeScript and Tern.
 */
function AdHocTypes(typescriptType, ternType) {
    if (this instanceof AdHocTypes) {
        this.typescriptType = typescriptType;
        this.ternType = ternType;

        return this;
    } else {
        return new AdHocTypes(typescriptType, ternType);
    }
}

/**
 * formats this type as a TypeScript type.
 */
AdHocTypes.prototype.toString = function() {
    return this.typescriptType;
};

/**
 * formats this type as a Tern type.
 */
AdHocTypes.prototype.formatTernType = function() {
    return formatTernType(this.ternType);
};

/**
 * resolves referencing types contained in this type.
 */
AdHocTypes.prototype.resolveReferencingType = function(method) {
    resolveReferencingType(this.typescriptType, method);
    resolveReferencingType(this.ternType, method);
};

/**
 * The type that refrences to other type of a parameter
 * (e.g. this type is same as the type of parameter "foo").
 */
function ReferencingType(parameterName) {
    if (this instanceof ReferencingType) {
        this.parameterName = parameterName;

        return this;
    } else {
        return new ReferencingType(parameterName);
    }
}

/**
 * formats this type as a TypeScript type.
 */
ReferencingType.prototype.toString = function() {
    return this.resolvedType.toString();
};

/**
 * formats this type as a Tern type.
 */
ReferencingType.prototype.formatTernType = function() {
    return this.resolvedType.formatTernType();
};

/**
 * resolves this referencing type to actual type.
 */
ReferencingType.prototype.resolveReferencingType = function(method) {
    var parameterName = this.parameterName;
    var parameterIndex = method.params.findIndex(function (param) {
        return param.name == parameterName;
    });

    this.resolvedParameterIndex = parameterIndex;
    this.resolvedType = method.params[parameterIndex].type;
};

/**
 * Types for the parameters of callback methods.
 *
 * See also "callbackParams" in `overrides`.
 */
var callbackParamTypes = {
    'addMembersArray': new ArrayType('KiiUser'),
    'adminContext': 'KiiAppAdminContext',
    'anErrorString': 'string',
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
    'group': 'KiiGroup',
    'groupList': new ArrayType('KiiGroup'),
    'isOwner': 'boolean',
    'isSubscribed': 'boolean',
    'memberList': new ArrayType('KiiUser'),
    'network': 'KiiSocialNetworkName',
    'nextPaginationKey': 'string',
    'nextQuery': 'KiiQuery',
    'obj': 'KiiObject',
    'publishedUrl': 'string',
    'query': 'KiiQuery',
    'queryPerformed': 'KiiQuery',
    'removeMembersArray': new ArrayType('KiiUser'),
    'statusCode': 'number',
    'subscription': 'KiiPushSubscription',
    'theACL': 'KiiACL',
    'theAuthenticatedUser': 'KiiUser',
    'theDeletedGroup': 'KiiGroup',
    'theDeletedObject': 'KiiObject',
    'theDeletedUser': 'KiiUser',
    'theEntries': new ArrayType('KiiACLEntry'),
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
    'thingAuthContext': 'KiiThingContext',
    'thingContext': 'KiiThingContext',
    'topic': 'KiiTopic',
    'topicList': new ArrayType('KiiTopic'),
    'user': 'KiiUser'
};

/**
 * The type information overrides for class members.
 */
var overrides = {
    "Kii": {
        "encryptedBucketWithName": {
            // declared to return KiiEncryptedBucket, but KiiEncryptedBucket
            // is not exported.
            "returnType": "KiiBucket"
        },
        "getAccessTokenExpiration": {
            // missing @return
            "returnType": "number"
        },
        "groupWithNameAndMembers": {
            "parameters": {
                // declared to return Array, adds a type argument
                "members": new ArrayType("KiiUser")
            }
        },
        "setAccessTokenExpiration": {
            "parameters": {
                // missing type annotation in @param
                "expiresIn": "number"
            }
        }
    },
    "KiiACLEntry": {
        "entryWithSubject": {
            "parameters": {
                // applies a type alias
                // FIXME: Subject → subject
                "Subject": "KiiACLSubject"
            },
            // missing type annotation in @return
            "returnType": "KiiACLEntry"
        },
        "getSubject": {
            // enriches type using type parameter
            "returnType": new AdHocTypes("T", "KiiACLSubject"),
            "typeParams": [
                "T extends KiiACLSubject"
            ]
        },
        "setSubject": {
            "parameters": {
                // applies a type alias
                "subject": "KiiACLSubject"
            }
        }
    },
    "KiiAnalytics": {
        "initialize": {
            "parameters": {
                // missing type annotation in @param
                "deviceid": "string"
            }
        },
        "initializeWithSite": {
            "parameters": {
                // missing type annotation in @param
                "deviceid": "string"
            }
        },
        "trackEvent": {
            // missing @return
            "returnType": new PromiseType()
        },
        "trackEventWithExtras": {
            // missing @return
            "returnType": new PromiseType()
        },
        "trackEventWithExtrasAndCallbacks": {
            "parameters": {
                // missing @example, we cannot guess parameters
                "callbacks": new CallbackType("KiiAnalytics", "trackEventWithExtrasAndCallbacks", [], [{"name": "error", "type": "Error"}])
            }
        }
    },
    "KiiAnonymousUser": {
        "getID": {
            // missing @return
            "returnType": "string"
        }
    },
    "KiiAnyAuthenticatedUser": {
        "getID": {
            // missing @return
            "returnType": "string"
        }
    },
    "KiiAppAdminContext": {
        "findUserByEmail": {
            "parameters": {
                // failed to guess callback parameters
                "callbacks": new CallbackType("KiiAppAdminContext", "findUserByEmail", [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "theMatchedUser", type: "KiiUser"}], [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "anErrorString", type: "string"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiAppAdminContext", "KiiUser")
        },
        "findUserByPhone": {
            "parameters": {
                // failed to guess callback parameters
                "callbacks": new CallbackType("KiiAppAdminContext", "findUserByPhone", [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "theMatchedUser", type: "KiiUser"}], [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "anErrorString", type: "string"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiAppAdminContext", "KiiUser")
        },
        "findUserByUsername": {
            "parameters": {
                // failed to guess callback parameters
                "callbacks": new CallbackType("KiiAppAdminContext", "findUserByUsername", [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "theMatchedUser", type: "KiiUser"}], [{"name": "adminContext", type: "KiiAppAdminContext"}, {"name": "anErrorString", type: "string"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiAppAdminContext", "KiiUser")
        },
        "registerGroupWithOwnerAndID": {
            "parameters": {
                // declared as Array, adds a type argument
                "members": new ArrayType("KiiUser")
            }
        },
        "registerOwnerWithThingID": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "registerOwnerWithVendorThingID": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "registerThing": {
            "parameters": {
                // declared as Object
                "fields": "KiiThingFields"
            }
        }
    },
    "KiiBucket": {
        "createObjectWithType": {
            // missing type annotation in @return
            "returnType": "KiiObject"
        },
        "executeQuery": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "resultSet": new ArrayType(new AdHocTypes("T", "?"))
                }
            },
            "typeParams": [
                "T"
            ]
        }
    },
    "KiiClause": {
        "and": {
            // declared as List, declares as a variadic parameter
            "parameters": {
                "A": new ArrayType("KiiClause")
            },
            "variadicParams": [
                "A"
            ],
            // missing @return
            "returnType": "KiiClause"
        },
        "equals": {
            // missing @return
            "returnType": "KiiClause"
        },
        "greaterThan": {
            // missing @return
            "returnType": "KiiClause"
        },
        "greaterThanOrEqual": {
            // missing @return
            "returnType": "KiiClause"
        },
        "inClause": {
            "parameters": {
                // declared to return Array
                "values": new ArrayType("any")
            },
            // missing @return
            "returnType": "KiiClause"
        },
        "lessThan": {
            // missing @return
            "returnType": "KiiClause"
        },
        "lessThanOrEqual": {
            // missing @return
            "returnType": "KiiClause"
        },
        "notEquals": {
            // missing @return
            "returnType": "KiiClause"
        },
        "or": {
            // declared as List, declares as a variadic parameter
            "parameters": {
                "A": new ArrayType("KiiClause")
            },
            "variadicParams": [
                "A"
            ],
            // missing @return
            "returnType": "KiiClause"
        },
        "not": {
            "parameters": {
                "clause": "KiiClause"
            },
            // missing @return
            "returnType": "KiiClause"
        },
        "startsWith": {
            // missing @return
            "returnType": "KiiClause"
        },
        "hasField": {
            // missing @return
            "returnType": "KiiClause"
        }
    },
    "KiiGeoPoint": {
        "getLatitude": {
            // missing @return
            "returnType": "number"
        },
        "getLongitude": {
            // missing @return
            "returnType": "number"
        }
    },
    "KiiGroup": {
        "encryptedBucketWithName": {
            // declared to return KiiEncryptedBucket, but KiiEncryptedBucket
            // is not exported.
            "returnType": "KiiBucket"
        },
        "groupWithID": {
            "parameters": {
                // missing type annotation in @param
                "groupId": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiGroup"
        },
        "groupWithNameAndMembers": {
            "parameters": {
                // declared as Array, adds a type argument
                "members": new ArrayType("KiiUser")
            }
        },
        "registerGroupWithID": {
            "parameters": {
                // declared as Array, adds a type argument
                "members": new ArrayType("KiiUser")
            }
        }
    },
    "KiiObject": {
        "get": {
            // enriches type using type parameter
            "returnType": new AdHocTypes("T", "?"),
            "typeParams": [
                "T"
            ]
        },
        "getCreated": {
            // declared to return String, but seems to return number
            "returnType": "number"
        },
        "isValidObjectID": {
            // missing type annotation in @return
            "returnType": "boolean"
        },
        "save": {
            "parameters": {
                // missing type annotation in @param
                "overwrite": "boolean"
            }
        },
        "saveAllFields": {
            "parameters": {
                // missing type annotation in @param
                "overwrite": "boolean"
            }
        },
        "getKeys": {
            // declared as Array, adds a type argument
            "returnType": new ArrayType("string")
        }
    },
    "KiiPushInstallation": {
        "installGcm": {
            "parameters": {
                // missing example
                "callbacks": new CallbackType("KiiPushInstallation", "installGcm", [{"name": "response", type: "KiiGcmInstallationResponse"}], [{"name": "error", type: "Error"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiGcmInstallationResponse")
        },
        "installMqtt": {
            "parameters": {
                // missing example
                "callbacks": new CallbackType("KiiPushInstallation", "installMqtt", [{"name": "response", type: "KiiMqttInstallationResponse"}], [{"name": "error", type: "Error"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiMqttInstallationResponse")
        },
        "getMqttEndpoint": {
            "parameters": {
                // missing example
                "callbacks": new CallbackType("KiiPushInstallation", "getMqttEndpoint", [{"name": "response", type: "KiiMqttEndpoint"}], [{"name": "error", type: "Error"}])
            },
            // declared to return Promise, adds type argument
            "returnType": new PromiseType("KiiMqttEndpoint")
        },
        "uninstall": {
            "parameters": {
                // missing example
                "callbacks": new CallbackType("KiiPushInstallation", "uninstall", [], [{"name": "error", type: "Error"}])
            }
        },
        "uninstallByInstallationID": {
            "parameters": {
                // missing example
                "callbacks": new CallbackType("KiiPushInstallation", "uninstallByInstallationID", [], [{"name": "error", type: "Error"}])
            }
        }
    },
    "KiiPushMessageBuilder": {
        "apnsAlert": {
            "parameters": {
                // declared as Object
                "alert": new AdHocTypes("string | APNSAlert", "string|APNSAlert")
            },
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "apnsBadge": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "apnsCategory": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "apnsContentAvailable": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "apnsData": {
            "parameters": {
                // declared as Object
                "data": new AdHocTypes("{ [key: string]: string | number | boolean }", "?")
            },
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "apnsSound": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "enableApns": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "enableGcm": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "enableJpush": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "enableMqtt": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "gcmCollapseKey": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "gcmData": {
            "parameters": {
                // declared as Object
                "data": new AdHocTypes("{ [key: string]: string }", "?")
            },
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "gcmDelayWhileIdle": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "gcmRestrictedPackageName": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "gcmTimeToLive": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "jpushData": {
            "parameters": {
                // declared as Object
                "data": new AdHocTypes("{ [name: string]: string | number | boolean }", "?")
            },
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "mqttData": {
            "parameters": {
                // declared as Object
                "data": new AdHocTypes("{ [key: string]: string }", "?")
            },
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "setSendToDevelopment": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        },
        "setSendToProduction": {
            // declared to return Object
            "returnType": "KiiPushMessageBuilder"
        }
    },
    "KiiPushSubscription": {
        "isSubscribed": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "topic": new ReferencingType("target")
                }
            },
            "parameters": {
                "target": new AdHocTypes("T", "+KiiBucket|+KiiTopic")
            },
            "typeParams": [
                "T extends KiiBucket | KiiTopic"
            ]
        },
        "subscribe": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "topic": new ReferencingType("target")
                }
            },
            "parameters": {
                "target": new AdHocTypes("T", "+KiiBucket|+KiiTopic")
            },
            "typeParams": [
                "T extends KiiBucket | KiiTopic"
            ]
        },
        "unsubscribe": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "topic": new ReferencingType("target")
                }
            },
            "parameters": {
                "target": new AdHocTypes("T", "+KiiBucket|+KiiTopic")
            },
            "typeParams": [
                "T extends KiiBucket | KiiTopic"
            ]
        }
    },
    "KiiQuery": {
        "queryWithClause": {
            "parameters": {
                // missing type annotation in @param
                "clause": "KiiClause"
            },
            // missing @return
            "returnType": "KiiQuery"
        },
        "setLimit": {
            "parameters": {
                // missing type annotation in @param
                "value": "number"
            }
        }
    },
    "KiiServerCodeEntry": {
        "execute": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "argument": new ReferencingType("argument")
                },
                "failure": {
                    "argument": new ReferencingType("argument")
                }
            },
            "parameters": {
                "argument": new AdHocTypes("T", "?")
            },
            "typeParams": [
                "T"
            ]
        }
    },
    "KiiSocialConnect": {
        "getAccessTokenExpirationForNetwork": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName"
            }
        },
        "getAccessTokenForNetwork": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName"
            }
        },
        "getAccessTokenObjectForNetwork": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName"
            }
        },
        "linkCurrentUserWithNetwork": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName",
                "options": "KiiSocialConnectOptions"
            }
        },
        "logIn": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName",
                "options": "KiiSocialConnectOptions"
            }
        },
        "unLinkCurrentUserFromNetwork": {
            "parameters": {
                // missing type annotation in @param
                "networkName": "KiiSocialNetworkName"
            }
        }
    },
    "KiiThing": {
        "fields": {
            // declared as Object
            "returnType": "KiiThingFields"
        },
        "encryptedBucketWithName": {
            // declared to return KiiEncryptedBucket, but KiiEncryptedBucket
            // is not exported.
            "returnType": "KiiBucket"
        },
        "isOwner": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "user": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "registerOwner": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "registerOwnerWithThingID": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "registerOwnerWithVendorThingID": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        },
        "unregisterOwner": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "group": new ReferencingType("owner")
                }
            },
            "parameters": {
                "owner": new AdHocTypes("T", "+KiiUser|+KiiGroup")
            },
            "typeParams": [
                "T extends KiiUser | KiiGroup"
            ]
        }
    },
    "KiiTopic": {
        "sendMessage": {
            // enriches type using type parameter
            "callbackParams": {
                "success": {
                    "message": new ReferencingType("message")
                }
            },
            "parameters": {
                "message": new AdHocTypes("T", "?")
            },
            "typeParams": [
                "T"
            ]
        }
    },
    "KiiUser": {
        // declared to return KiiEncryptedBucket, but KiiEncryptedBucket
        // is not exported.
        "encryptedBucketWithName": {
            "returnType": "KiiBucket"
        },
        "get": {
            // enriches type using type parameter
            "returnType": new AdHocTypes("T", "?"),
            "typeParams": [
                "T"
            ]
        },
        "getAccessTokenObject": {
            // declared to return Object
            "returnType": "KiiAccessTokenObject"
        },
        "getLinkedSocialAccounts": {
            // declared to return Object
            "returnType": new AdHocTypes("{ [name: string]: KiiSocialAccountInfo }", "?")
        },
        "loggedIn": {
            // missing @return
            "returnType": "boolean"
        },
        "putIdentity": {
            "parameters": {
                // missing type annotation in @param
                "password": "string",
                // declared as Array, adds a type argument
                "removeFields": new ArrayType("string")
            }
        },
        "update": {
            "parameters": {
                // declared as Array, adds a type argument
                "removeFields": new ArrayType("string")
            }
        },
        "userWithCredentials": {
            "parameters": {
                // missing type annotation in @param
                "emailAddress": "string",
                "password": "string",
                "phoneNumber": "string",
                "username": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithEmailAddress": {
            "parameters": {
                // missing type annotation in @param
                "emailAddress": "string",
                "password": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithEmailAddressAndPhoneNumber": {
            "parameters": {
                // missing type annotation in @param
                "emailAddress": "string",
                "password": "string",
                "phoneNumber": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithEmailAddressAndUsername": {
            "parameters": {
                // missing type annotation in @param
                "emailAddress": "string",
                "password": "string",
                "username": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithID": {
            "parameters": {
                // missing type annotation in @param
                "userID": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithPhoneNumber": {
            "parameters": {
                // missing type annotation in @param
                "password": "string",
                "phoneNumber": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithPhoneNumberAndUsername": {
            "parameters": {
                // missing type annotation in @param
                "password": "string",
                "phoneNumber": "string",
                "username": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        },
        "userWithUsername": {
            "parameters": {
                // missing type annotation in @param
                "password": "string",
                "username": "string"
            },
            // missing type annotation in @return
            "returnType": "KiiUser"
        }
    },
    "KiiUserBuilder": {
        "builderWithGlobalPhoneNumber": {
            "parameters": {
                // missing @param
                "password": "string"
            }
        }
    },
    "KiiErrorParser": {
        "parse": {
            "parameters": {
                "error": new AdHocTypes("T", "+string|+Error")
            },
            "typeParams": [
                "T extends string | Error"
            ],
            "returnType": "KiiError"
        }
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

    var callbackParamIndex = method.params.findIndex(function (param) {
        return param.name == "callbacks";
    });

    var callbackParam =
            (callbackParamIndex == -1)
            ? null
            : method.params[callbackParamIndex];

    if (callbackParam) {
        var successParams =
                extractParamsFromExamples(classSymbol, method, /success: function\(([^)]*)\)/, "success");
        var failureParams =
                extractParamsFromExamples(classSymbol, method, /failure: function\(([^)]*)\)/, "failure");

        callbackParam.type = new CallbackType(classSymbol.name, method.name, successParams, failureParams);

        callbackParam.isOptional = true;

        method.type = PromiseType.apply(this, successParams.map(function (param) { return param.type; }));
    }

    return method;
}

/**
 * extracts parameter names of a callback method from code examples.
 */
function extractParamsFromExamples(classSymbol, method, pattern, callbackName) {
    var params = [];

    var overrides = lookupClassMemberOverrides(classSymbol, method);

    var overridesForCallback =
            (overrides.callbackParams || {})[callbackName] || {};

    for (var example of method.example) {
        var match = example.desc.match(pattern);

        if (!match || match[1] == "") {
            continue;
        }

        params = match[1].split(/, */);
        params = params.map(function (param) {
            var type =
                    overridesForCallback[param] ||
                    callbackParamTypes[param];

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

/**
 * adds "call" effects to method effect for Tern.
 */
function addTernEffectsForCallbacks(classSymbol, method) {
    var callbackParamIndex = method.params.findIndex(function (param) {
        return param.name == "callbacks";
    });

    var callbackParam =
            (callbackParamIndex == -1)
            ? null
            : method.params[callbackParamIndex];

    if (callbackParam) {
        var successParams =
                extractParamsFromExamples(classSymbol, method, /success: function\(([^)]*)\)/, "success");
        var failureParams =
                extractParamsFromExamples(classSymbol, method, /failure: function\(([^)]*)\)/, "failure");

        method.ternEffects = method.ternEffects || [];

        var getCallEffectType = function (param) {
            if (typeof param.type.resolvedParameterIndex === "number") {
                return "!" + param.type.resolvedParameterIndex;
            } else {
                return formatTernType(param.type);
            }
        };

        var successCallEffectArguments = successParams.map(getCallEffectType);
        var failureCallEffectArguments = failureParams.map(getCallEffectType);

        method.ternEffects.push(
            "call !" + callbackParamIndex + ".success " + successCallEffectArguments.join(" ")
        );
        method.ternEffects.push(
            "call !" + callbackParamIndex + ".failure " + failureCallEffectArguments.join(" ")
        );
    }
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
function lookupClassMemberOverrides(classSymbol, method) {
    var mapForClass = overrides[classSymbol.name] || {};

    return mapForClass[method.name] || {};
}

/**
 * overrides the type parameters of the given method.
 */
function overrideMethodTypeParams(classSymbol, method) {
    var overrides = lookupClassMemberOverrides(classSymbol, method);

    if (overrides.typeParams) {
        method.typeParams = overrides.typeParams;
    }

    return method;
}

/**
 * overrides the types of the parameters.
 */
function overrideMethodParamTypes(classSymbol, method) {
    var overrides = lookupClassMemberOverrides(classSymbol, method);

    if (overrides.parameters) {
        method.params.forEach(function (param) {
            if (overrides.parameters[param.name]) {
                param.type = overrides.parameters[param.name];
            }
        });
    }

    return method;
}

/**
 * overrides the return type of the given method or property.
 */
function overrideReturnType(classSymbol, symbol) {
    var overrides = lookupClassMemberOverrides(classSymbol, symbol);

    if (overrides.returnType) {
        symbol.type = overrides.returnType;
    }

    return symbol;
}

/**
 * marks some parameters as a variadic parameters.
 */
function overrideVariadicParams(classSymbol, method) {
    var overrides = lookupClassMemberOverrides(classSymbol, method);

    if (overrides.variadicParams) {
        for (var param of method.params) {
            if (overrides.variadicParams.indexOf(param.name) >= 0) {
                param.isVariadic = true;
            }
        }
    }

    return method;
}

/**
 * overrides the `ternEffects` of the given method.
 */
function overrideTernEffects(classSymbol, method) {
    var overrides = lookupClassMemberOverrides(classSymbol, method);

    if (overrides.ternEffects) {
        method.ternEffects = overrides.ternEffects;
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

    identityDataParam.type = "identityData";

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

    output.push("// Type definitions for Kii Cloud SDK " + (process.env.KII_VERSION || "") + "\n");
    output.push("// Project: http://en.kii.com/\n");
    output.push("// Definitions by: Kii Consortium <http://jp.kii.com/consortium/>\n");
    output.push("// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped\n");
    output.push("\n");

    output.push("declare namespace KiiCloud {\n");

    output.push("    enum KiiACLAction {\n");
    output.push("        KiiACLBucketActionCreateObjects,\n");
    output.push("        KiiACLBucketActionQueryObjects,\n");
    output.push("        KiiACLBucketActionDropBucket,\n");
    output.push("        KiiACLObjectActionRead,\n");
    output.push("        KiiACLObjectActionWrite,\n");
    output.push("        KiiACLBucketActionReadObjects,\n");
    output.push("        KiiACLSubscribeToTopic,\n");
    output.push("        KiiACLSendMessageToTopic,\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    export enum KiiSite {\n");
    output.push("        US,\n");
    output.push("        JP,\n");
    output.push("        CN,\n");
    output.push("        SG,\n");
    output.push("        CN3,\n");
    output.push("        EU\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    export enum KiiAnalyticsSite {\n");
    output.push("        US,\n");
    output.push("        JP,\n");
    output.push("        CN,\n");
    output.push("        SG,\n");
    output.push("        CN3,\n");
    output.push("        EU\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    enum KiiSocialNetworkName {\n");
    output.push("        FACEBOOK = 1,\n");
    output.push("        TWITTER = 2,\n");
    output.push("        QQ = 3,\n");
    output.push("        GOOGLEPLUS = 4,\n");
    output.push("        RENREN = 5\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    type KiiSocialConnectOptions = {\n");
    output.push("        access_token: string,\n");
    output.push("        openID?: string\n");
    output.push("    } | {\n");
    output.push("        oauth_token: string,\n");
    output.push("        oauth_token_secret: string\n");
    output.push("    };\n");
    output.push("\n");

    output.push("    interface KiiSocialAccountInfo {\n");
    output.push("        createdAt: number;\n");
    output.push("        provider: KiiSocialNetworkName;\n");
    output.push("        socialAccountId: string;\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    interface KiiThingFields {\n");
    output.push("        /**\n");
    output.push("         * thing identifier given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _vendorThingID: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * thing password given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _password: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * thing type given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _thingType?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * vendor identifier given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _vendor?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * firmware version given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _firmwareVersion?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * lot identifier given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _lot?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * product name given by thing vendor.\n");
    output.push("         */\n");
    output.push("        _productName?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary string field.\n");
    output.push("         */\n");
    output.push("        _stringField1?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary string field.\n");
    output.push("         */\n");
    output.push("        _stringField2?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary string field.\n");
    output.push("         */\n");
    output.push("        _stringField3?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary string field.\n");
    output.push("         */\n");
    output.push("        _stringField4?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary string field.\n");
    output.push("         */\n");
    output.push("        _stringField5?: string;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary number field.\n");
    output.push("         */\n");
    output.push("        _numberField1?: number;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary number field.\n");
    output.push("         */\n");
    output.push("        _numberField2?: number;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary number field.\n");
    output.push("         */\n");
    output.push("        _numberField3?: number;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary number field.\n");
    output.push("         */\n");
    output.push("        _numberField4?: number;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * arbitrary number field.\n");
    output.push("         */\n");
    output.push("        _numberField5?: number;\n");
    output.push("\n");
    output.push("        /**\n");
    output.push("         * custom fields.\n");
    output.push("         */\n");
    output.push("        [name: string]: any;\n");
    output.push("    }\n");
    output.push("\n");

    output.push("    type KiiACLSubject =\n");
    output.push("        KiiGroup |\n");
    output.push("        KiiUser |\n");
    output.push("        KiiAnyAuthenticatedUser |\n");
    output.push("        KiiAnonymousUser |\n");
    output.push("        KiiThing;\n");
    output.push("\n");

    output.push('    interface APNSAlert {\n');
    output.push('        title: string;\n');
    output.push('        body: string;\n');
    output.push('        "title-loc-key": string;\n');
    output.push('        "title-loc-args": string[];\n');
    output.push('        "action-loc-key": string;\n');
    output.push('        "loc-key": string;\n');
    output.push('        "loc-args": string[];\n');
    output.push('        "launch-image": string;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface identityData {\n');
    output.push('        emailAddress?: string;\n');
    output.push('        phoneNumber?: string;\n');
    output.push('        username?: string;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface KiiAccessTokenObject {\n');
    output.push('        access_token: string;\n');
    output.push('        expires_at: Date;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface KiiGcmInstallationResponse {\n');
    output.push('        installationID: string;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface KiiMqttInstallationResponse {\n');
    output.push('        installationID: string;\n');
    output.push('        installationRegistrationID: string;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface KiiMqttEndpoint {\n');
    output.push('        installationID: string;\n');
    output.push('        username: string;\n');
    output.push('        password: string;\n');
    output.push('        mqttTopic: string;\n');
    output.push('        host: string;\n');
    output.push('        "X-MQTT-TTL": number;\n');
    output.push('        portTCP: number;\n');
    output.push('        portSSL: number;\n');
    output.push('        portWS: number;\n');
    output.push('        portWSS: number;\n');
    output.push('    }\n');
    output.push('\n');

    output.push('    interface KiiError {\n');
    output.push('        status: number;\n');
    output.push('        code: string;\n');
    output.push('        message: string;\n');
    output.push('    }\n');
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
    output.push("    /**\n");
    output.push(classSymbol.classDesc.replace(/^(    )?/gm, "     * "));
    output.push("\n");
    output.push("     */\n");

    output.push("    export class " + classSymbol.name + " {\n");

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

    output.push("    }\n");
}

/**
 * formats a property into the buffer.
 */
function formatProperty(property, output) {
    output.push("        /**\n");
    output.push(property.desc.replace(/^(  )?/gm, "         * "));
    output.push("\n");
    output.push("         */\n");
    output.push("        " + property.name + ": " + (property.type || "any") + ";\n");
}

/**
 * formats a method into the buffer.
 */
function formatMethod(classSymbol, method, output) {
    // JsDoc comments

    output.push("        /**\n");
    output.push(method.desc.replace(/^(  )?/gm, "         * "));
    output.push("\n");

    if (method.deprecated) {
        output.push("         *\n");

        output.push("         * @deprecated ");
        output.push(method.deprecated.replace(/\n */gm, "\n         *   "));
        output.push("\n");
    }

    if (method.params.length > 0) {
        output.push("         *\n");

        method.params.forEach(function (param) {
            output.push("         * @param " + param.name + " ");
            output.push(param.desc.replace(/\n */gm, "\n         *   "));
            output.push("\n");
        });
    }

    if (method.returns.length > 0) {
        output.push("         *\n");

        method.returns.forEach(function (ret) {
            output.push("         * @return ");
            output.push(ret.desc.replace(/\n(    )?/gm, "\n         *   "));
            output.push("\n");
        });
    }

    if (method.exceptions.length > 0) {
        output.push("         *\n");

        method.exceptions.forEach(function (exception) {
            output.push("         * @throws ");
            output.push(exception.desc.replace(/\n(    )?/gm, "\n         *   "));
            output.push("\n");
        });
    }

    if (method.see.length > 0) {
        output.push("         *\n");

        method.see.forEach(function (see) {
            output.push("         * @see " + see + "\n");
        });
    }

    if (method.example.length > 0) {
        output.push("         *\n");

        method.example.forEach(function (example) {
            output.push("         * @example\n");
            output.push(example.desc.replace(/^/gm, "         *   "));
            output.push("\n");
        });
    }

    output.push("         */\n");

    // method declaration

    var isConstructor = classSymbol.name == method.name;

    var name = isConstructor ? "constructor" : method.name;

    output.push("        " + (method.isStatic ? "static " : "") + name);

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


var ternTypeAliases = {
    "KiiSocialConnectOptions": "tokenConnectOptions | oauthConnectOptions",
    tokenConnectOptions: {
        "access_token": "string",
        "openID?": "string"
    },
    oauthConnectOptions: {
        "oauth_token": "string",
        "oauth_token_secret": "string"
    },

    "KiiSocialAccountInfo": {
        "createdAt": "number",
        "provider": "KiiSocialNetworkName",
        "socialAccountId": "string"
    },

    "KiiThingFields": {
        "_vendorThingID": "string",
        "_password": "string",
        "_thingType?": "string",
        "_vendor?": "string",
        "_firmwareVersion?": "string",
        "_lot?": "string",
        "_stringField1?": "string",
        "_stringField2?": "string",
        "_stringField3?": "string",
        "_stringField4?": "string",
        "_stringField5?": "string",
        "_numberField1?": "number",
        "_numberField2?": "number",
        "_numberField3?": "number",
        "_numberField4?": "number",
        "_numberField5?": "number"
    },

    "KiiACLSubject": "KiiGroup | KiiUser | KiiAnyAuthenticatedUser | KiiAnonymousUser | KiiThing",

    "APNSAlert": {
        "title": "string",
        "body": "string",
        "title-loc-key": "string",
        "title-loc-args": "[string]",
        "action-loc-key": "string",
        "loc-key": "string",
        "loc-args": "[string]",
        "launch-image": "string"
    },

    "identityData": {
        "emailAddress?": "string",
        "phoneNumber?": "string",
        "username?": "string"
    },

    "KiiAccessTokenObject": {
        "access_token": "string",
        "expires_at": "Date"
    },

    "KiiGcmInstallationResponse": {
        "installationID": "string"
    },

    "KiiMqttInstallationResponse": {
        "installationID": "string",
        "installationRegistrationID": "string"
    },

    "KiiMqttEndpoint": {
        "installationID": "string",
        "username": "string",
        "password": "string",
        "mqttTopic": "string",
        "host": "string",
        "X-MQTT-TTL": "number",
        "portTCP": "number",
        "portSSL": "number",
        "portWS": "number",
        "portWSS": "number"
    },

    "KiiError": {
        "status": "number",
        "code": "string",
        "message": "string"
    }
};

/**
 * builds tern JSON type definitions.
 */
function buildTernJSONTypeDefinitions(classes) {
    var typeDefinitions = {
        "!name": "KiiCloud",

        "!define": ternTypeAliases,

        "KiiACLAction": {
            "KiiACLBucketActionCreateObjects": "+KiiACLAction",
            "KiiACLBucketActionQueryObjects": "+KiiACLAction",
            "KiiACLBucketActionDropBucket": "+KiiACLAction",
            "KiiACLObjectActionRead": "+KiiACLAction",
            "KiiACLObjectActionWrite": "+KiiACLAction",
            "KiiACLBucketActionReadObjects": "+KiiACLAction",
            "KiiACLSubscribeToTopic": "+KiiACLAction",
            "KiiACLSendMessageToTopic": "+KiiACLAction"
        },

        "KiiSite": {
            "US": "+KiiSite",
            "JP": "+KiiSite",
            "CN": "+KiiSite",
            "SG": "+KiiSite",
            "CN3": "+KiiSite",
            "EU": "+KiiSite"
        },

        "KiiAnalyticsSite": {
            "US": "+KiiAnalyticsSite",
            "JP": "+KiiAnalyticsSite",
            "CN": "+KiiAnalyticsSite",
            "SG": "+KiiAnalyticsSite",
            "CN3": "+KiiAnalyticsSite",
            "EU": "+KiiAnalyticsSite"
        },

        "KiiSocialNetworkName": {
            "FACEBOOK": "number",
            "TWITTER": "number",
            "QQ": "number",
            "GOOGLEPLUS": "number",
            "RENREN": "number"
        }
    };

    classes.forEach(function (classSymbol) {
        typeDefinitions[classSymbol.name] = typeDefinitions[classSymbol.name] || {};
        typeDefinitions[classSymbol.name].prototype = typeDefinitions[classSymbol.name].prototype || {};

        classSymbol.properties.forEach(function (property) {
            typeDefinitions[classSymbol.name][property.name] =
                formatTernType(property.ternReturnType || property.type || "?");
        });

        classSymbol.methods.forEach(function (method) {
            if (classSymbol.name == method.name) {
                typeDefinitions[classSymbol.name]["!type"] =
                    formatTernMethodType(classSymbol, method);
            } else if (method.isStatic) {
                typeDefinitions[classSymbol.name][method.name] =
                    formatTernMethodType(classSymbol, method);
            } else {
                typeDefinitions[classSymbol.name].prototype[method.name] =
                    formatTernMethodType(classSymbol, method);
            }
        });
    });

    return typeDefinitions;
}

function formatTernMethodType(classSymbol, method) {
    var type = "fn(";

    type += method.params.map(function (param) {
        return param.name + (param.isOptional ? "?" : "") + ": " + formatTernType(param.type || "?");
    }).join(", ");

    type += ")";

    if (method.type) {
        type += " -> " + formatTernType(method.type);
    }

    if (method.ternEffects) {
        return {
            "!type": type,
            "!effects": method.ternEffects
        };
    } else {
        return type;
    }
}
