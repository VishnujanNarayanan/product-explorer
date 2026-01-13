"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreService = void 0;
const common_1 = require("@nestjs/common");
let CoreService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var CoreService = _classThis = class {
        constructor(navigationRepository, categoryRepository) {
            this.navigationRepository = navigationRepository;
            this.categoryRepository = categoryRepository;
        }
        async getNavigation() {
            // Return from database, will trigger scrape if empty
            return this.navigationRepository.find({
                relations: ['categories'],
                order: { id: 'ASC' },
            });
        }
        async getCategoriesByNavigation(navigationSlug) {
            const navigation = await this.navigationRepository.findOne({
                where: { slug: navigationSlug },
                relations: ['categories'],
            });
            if (!navigation) {
                return [];
            }
            return this.categoryRepository.find({
                where: { navigation: { id: navigation.id } },
                relations: ['children', 'parent'],
                order: { title: 'ASC' },
            });
        }
        async getAllCategories() {
            return this.categoryRepository.find({
                relations: ['navigation', 'children', 'parent'],
                order: { title: 'ASC' },
            });
        }
        async getCategoryBySlug(slug) {
            return this.categoryRepository.findOne({
                where: { slug },
                relations: ['navigation', 'children', 'parent', 'products'],
            });
        }
        async healthCheck() {
            // Test database connection
            let dbStatus = 'OK';
            try {
                await this.navigationRepository.count();
            }
            catch (error) {
                dbStatus = `ERROR: ${error.message}`;
            }
            return {
                status: 'OK',
                timestamp: new Date(),
                services: {
                    database: dbStatus,
                },
            };
        }
    };
    __setFunctionName(_classThis, "CoreService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CoreService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CoreService = _classThis;
})();
exports.CoreService = CoreService;
