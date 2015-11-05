set -eu

if (( $# < 1 ))
then
    echo "Usage: preprocess html5-cloud-sdk-v2.2.2.js" >&2
    exit -1
fi

# some type annotation for @param are not surround by curly braces.

# removes the extra trailing dot of `@param {String} restrictedPackageName.`.

sed -r -e 's/@param (String|KiiSite|Boolean|Object|KiiQuery|KiiAnalyticsSite|Number)/@param {\1}/g; s/@param \{String\} restrictedPackageName./@param {String} restrictedPackageName/' < "$1" > preprocessed.js
