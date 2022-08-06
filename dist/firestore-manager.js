"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoyFirestoreManager = void 0;
var rxjs_1 = require("rxjs");
function obsIteratorFromDynamicArray(_a) {
    var index, dynamicArrayHasValues, nextObs;
    var dynamicArray = _a.dynamicArray;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                index = 0;
                dynamicArrayHasValues = true;
                nextObs = dynamicArray[index++];
                _b.label = 1;
            case 1:
                if (!dynamicArrayHasValues) return [3 /*break*/, 5];
                if (!nextObs) return [3 /*break*/, 3];
                return [4 /*yield*/, nextObs];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                dynamicArrayHasValues = false;
                _b.label = 4;
            case 4:
                nextObs = dynamicArray[index++];
                return [3 /*break*/, 1];
            case 5: return [2 /*return*/];
        }
    });
}
;
var MoyFirestoreManager = /** @class */ (function () {
    function MoyFirestoreManager(admin, collection) {
        var _this = this;
        this.admin = admin;
        this.collection = collection;
        this.fs = this.admin.firestore();
        this.batch = this.fs.batch();
        this.commitQueue = [];
        this.afterCommitCRUD = { create: {}, read: {}, update: {}, delete: {} };
        this.doc = function (id) {
            var _a;
            return (_a = _this.afterCommitCRUD.create[id]) === null || _a === void 0 ? void 0 : _a.body;
        };
        this.commit = function () {
            var obsIterator = obsIteratorFromDynamicArray({ dynamicArray: _this.commitQueue });
            return rxjs_1.of(true).pipe(rxjs_1.expand(function () { return obsIterator.next().value || rxjs_1.of('__END__'); }), rxjs_1.skipWhile(function (v) { return v !== '__END__'; }), rxjs_1.take(1), rxjs_1.concatMap(function () { return rxjs_1.from(_this.batch.commit()); }), rxjs_1.map(function () { return _this.afterCommitCRUD; }), rxjs_1.tap(function () { return _this.reset(); }));
        };
        this.readToQueue = function (prop, values, sideEffect) {
            var baseExpression = rxjs_1.from(_this.fs.collection(_this.collection).where(prop, 'in', values).get()).pipe(rxjs_1.tap(function (query) { return query.docs.forEach(function (d) { return _this.updateAfterCommitCRUD(d.id, 'read', __assign(__assign({}, d.data()), { uid: d.id })); }); }));
            _this.expressionToQueue(baseExpression, sideEffect);
        };
        this.batchToQueue = function (documentId, body, sideEffect) {
            var ref = _this.ref(documentId);
            _this.updateAfterCommitCRUD(ref.id, documentId ? 'update' : 'create', body);
            var baseExpression = function () { return _this.batch.set(ref, body, { merge: true }); };
            _this.expressionToQueue(baseExpression, sideEffect);
        };
        this.deleteToQueue = function (documentId, sideEffect) {
            var ref = _this.ref(documentId);
            _this.updateAfterCommitCRUD(ref.id, 'delete', {});
            var baseExpression = function () { return _this.batch.delete(ref); };
            _this.expressionToQueue(baseExpression, sideEffect);
        };
        this.expressionToQueue = function (expression, sideEffect) {
            if (expression instanceof rxjs_1.Observable) {
                _this.commitQueue.push(sideEffect ? expression.pipe(rxjs_1.tap({ next: function () { return sideEffect(); } })) : expression);
            }
            else {
                var exprToObs = rxjs_1.defer(function () { return rxjs_1.of(expression()); });
                _this.commitQueue.push(sideEffect ? exprToObs.pipe(rxjs_1.tap({ next: function () { return sideEffect(); } })) : exprToObs);
            }
        };
        this.ref = function (id) {
            var collectionRef = _this.fs.collection(_this.collection);
            return id ? collectionRef.doc(id) : collectionRef.doc();
        };
        this.updateAfterCommitCRUD = function (id, action, body) {
            var _a;
            _this.afterCommitCRUD[action][id] = __assign(__assign({}, (((_a = _this.afterCommitCRUD[action][id]) === null || _a === void 0 ? void 0 : _a.body) || {})), body);
        };
        this.reset = function () {
            _this.batch = _this.fs.batch();
            _this.commitQueue = [];
            _this.afterCommitCRUD = { create: {}, read: {}, update: {}, delete: {} };
        };
    }
    return MoyFirestoreManager;
}());
exports.MoyFirestoreManager = MoyFirestoreManager;
