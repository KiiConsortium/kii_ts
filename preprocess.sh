set -eu

if (( $# < 1 ))
then
    echo "Usage: preprocess html5-cloud-sdk-v2.2.2.js" >&2
    exit -1
fi

# some type annotation for @param are not surround by curly braces.

# removes the extra trailing dot of `@param {String} restrictedPackageName.`.

# change `@param {String} The ID of thing` to `@param {String} thingID The ID of thing`

# change `@param {String} The vendor thing ID of thing` to `@param {String} vendorThingID The vendor thing ID of thing`

sed -r -e 's/@param (String|KiiSite|Boolean|Object|KiiQuery|KiiAnalyticsSite|Number)/@param {\1}/g; s/@param \{String\} restrictedPackageName./@param {String} restrictedPackageName/; s/@param \{String\} The ID of thing/@param {String} thingID The ID of thing/; s/@param \{String\} The vendor thing ID of thing/@param {String} vendorThingID The vendor thing ID of thing/' < "$1" > preprocessed.js
