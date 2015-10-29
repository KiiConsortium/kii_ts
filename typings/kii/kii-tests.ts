/// <reference path="kii.d.ts" />

function main() {
    Kii.initializeWithSite("abc", "def", KiiSite.JP);

    var user = KiiUser.userWithUsername("name", "password");

    user.register({
        success: function (user: KiiUser) {
        },
        failure: function (user: KiiUser, message: string) {
        }
    });

    user.register()
        .then(function (user: KiiUser) {
        });

    var bucket = Kii.bucketWithName("foo");
    var clause1 = KiiClause.lessThan("x", 1);
    var clause2 = KiiClause.greaterThan("y", 1);
    var clause3 = KiiClause.and(clause1, clause2);
    var query = KiiQuery.queryWithClause(clause3);

    bucket.executeQuery(query, {
        success: function (query: KiiQuery,
                           results: KiiObject[],
                           nextQuery: KiiQuery) {
        },
        failure: function (bucket: KiiBucket, message: string) {
        }
    });

    bucket.executeQuery<KiiObject>(query)
        .then(function (params: [KiiQuery, KiiObject[], KiiQuery]) {
            var [query, results, nextQuery] = params;
        });

    var object = bucket.createObject();

    object.set("foo", 1);

    object.save();
}
