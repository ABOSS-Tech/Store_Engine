import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  adminHeaders,
  createAdminUser,
} from "../../../../helpers/create-admin-user"
import { getProductFixture } from "../../../../helpers/fixtures"

jest.setTimeout(50000)

medusaIntegrationTestRunner({
  testSuite: ({ dbConnection, getContainer, api }) => {
    let baseProduct
    let proposedProduct
    let publishedProduct
    let deletedProduct

    let baseCollection
    let publishedCollection

    let baseType
    let baseTag1
    let baseTag2
    let newTag

    let shippingProfile

    beforeEach(async () => {
      await createAdminUser(dbConnection, adminHeaders, getContainer())

      baseCollection = (
        await api.post(
          "/admin/collections",
          { title: "base-collection" },
          adminHeaders
        )
      ).data.collection

      publishedCollection = (
        await api.post(
          "/admin/collections",
          { title: "proposed-collection" },
          adminHeaders
        )
      ).data.collection

      baseType = (
        await api.post(
          "/admin/product-types",
          { value: "test-type" },
          adminHeaders
        )
      ).data.product_type

      baseTag1 = (
        await api.post("/admin/product-tags", { value: "123" }, adminHeaders)
      ).data.product_tag

      baseTag2 = (
        await api.post("/admin/product-tags", { value: "456" }, adminHeaders)
      ).data.product_tag

      newTag = (
        await api.post(
          "/admin/product-tags",
          { value: "new-tag" },
          adminHeaders
        )
      ).data.product_tag

      shippingProfile = (
        await api.post(
          `/admin/shipping-profiles`,
          { name: "default", type: "default" },
          adminHeaders
        )
      ).data.shipping_profile

      baseProduct = (
        await api.post(
          "/admin/products",
          getProductFixture({
            title: "Base product",
            collection_id: baseCollection.id,
            // BREAKING: Type input changed from {type: {value: string}} to {type_id: string}
            type_id: baseType.id,
            tags: [{ id: baseTag1.id }, { id: baseTag2.id }],
            shipping_profile_id: shippingProfile.id,
            images: [
              {
                url: "image-one",
              },
              {
                url: "image-two",
              },
            ],
          }),
          adminHeaders
        )
      ).data.product

      proposedProduct = (
        await api.post(
          "/admin/products",
          getProductFixture({
            title: "Proposed product",
            status: "proposed",
            tags: [{ id: newTag.id }],
            type_id: baseType.id,
            shipping_profile_id: shippingProfile.id,
          }),
          adminHeaders
        )
      ).data.product

      publishedProduct = (
        await api.post(
          "/admin/products",
          getProductFixture({
            title: "Published product",
            status: "published",
            collection_id: publishedCollection.id,
            tags: [{ id: baseTag1.id }, { id: baseTag2.id }],
            shipping_profile_id: shippingProfile.id,
          }),
          adminHeaders
        )
      ).data.product
      deletedProduct = (
        await api.post(
          "/admin/products",
          getProductFixture({
            title: "Deleted product",
            shipping_profile_id: shippingProfile.id,
          }),
          adminHeaders
        )
      ).data.product
      await api.delete(`/admin/products/${deletedProduct.id}`, adminHeaders)
    })

    describe("/admin/products", () => {
      describe("GET /admin/products", () => {
        it("returns a list of products with images ordered by rank", async () => {
          const res = await api.get("/admin/products", adminHeaders)

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                images: expect.arrayContaining([
                  expect.objectContaining({ url: "image-one", rank: 0 }),
                  expect.objectContaining({ url: "image-two", rank: 1 }),
                ]),
              }),
            ])
          )
        })

        it("returns a list of products with all statuses when no status or invalid status is provided", async () => {
          const res = await api
            .get("/admin/products", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                status: baseProduct.status,
              }),
              expect.objectContaining({
                id: proposedProduct.id,
                status: proposedProduct.status,
              }),
            ])
          )
        })

        it("returns a list of all products when no query is provided", async () => {
          const res = await api
            .get("/admin/products?q=", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
              }),
              expect.objectContaining({
                id: proposedProduct.id,
              }),
            ])
          )
        })

        // TODO: replace factory with API call
        it.skip("should return prices not in price list for list product endpoint", async () => {
          // await simplePriceListFactory(dbConnection, {
          //   prices: [
          //     {
          //       variant_id: "test-variant",
          //       amount: 100,
          //       currency_code: "usd",
          //     },
          //   ],
          // })

          const res = await api.get(
            "/admin/products?id=test-product",
            adminHeaders
          )

          const prices = res.data.products[0].variants
            .map((v) => v.prices)
            .flat()

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: "test-product",
                status: "draft",
              }),
            ])
          )
          expect(prices).toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({ price_list_id: expect.any(String) }),
            ])
          )
        })

        it("returns a list of products where status is proposed", async () => {
          const payload = {
            status: "proposed",
          }

          await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const response = await api
            .get("/admin/products?status[]=proposed", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                status: "proposed",
              }),
            ])
          )
        })

        it("returns a list of products where status is proposed or published", async () => {
          const notExpected = [
            expect.objectContaining({ status: "draft" }),
            expect.objectContaining({ status: "rejected" }),
            expect.objectContaining({
              id: baseProduct.id,
            }),
          ]

          const response = await api
            .get("/admin/products?status[]=published,proposed", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(2)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: proposedProduct.id,
                status: "proposed",
              }),
              expect.objectContaining({
                id: publishedProduct.id,
                status: "published",
              }),
            ])
          )

          for (const notExpect of notExpected) {
            expect(response.data.products).toEqual(
              expect.not.arrayContaining([notExpect])
            )
          }
        })

        it("returns a list of products where type_id is filtered", async () => {
          const response = await api
            .get(`/admin/products?type_id[]=${baseType.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(2)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type_id: baseType.id,
              }),
            ])
          )
        })

        it("returns a list of products where id is a list", async () => {
          const response = await api
            .get(
              `/admin/products?id[]=${baseProduct.id},${proposedProduct.id}`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(2)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
              }),
              expect.objectContaining({
                id: proposedProduct.id,
              }),
            ])
          )
        })

        // TODO: Decide how this should be handled in v2
        it.skip("returns a list of products filtered by discount condition id", async () => {
          // const resProd = await api.get("/admin/products", adminHeaders)
          // const prod1 = resProd.data.products[0]
          // const prod2 = resProd.data.products[2]
          // const buildDiscountData = (code, conditionId, products) => {
          //   return {
          //     code,
          //     rule: {
          //       type: DiscountRuleType.PERCENTAGE,
          //       value: 10,
          //       allocation: AllocationType.TOTAL,
          //       conditions: [
          //         {
          //           id: conditionId,
          //           type: DiscountConditionType.PRODUCTS,
          //           operator: DiscountConditionOperator.IN,
          //           product_tags: products,
          //         },
          //       ],
          //     },
          //   }
          // }
          // const discountConditionId = IdMap.getId("discount-condition-prod-1")
          // await simpleDiscountFactory(
          //   dbConnection,
          //   buildDiscountData("code-1", discountConditionId, [prod1.id])
          // )
          // const discountConditionId2 = IdMap.getId("discount-condition-prod-2")
          // await simpleDiscountFactory(
          //   dbConnection,
          //   buildDiscountData("code-2", discountConditionId2, [prod2.id])
          // )
          // let res = await api.get(
          //   `/admin/products?discount_condition_id=${discountConditionId}`,
          //   adminHeaders
          // )
          // expect(res.status).toEqual(200)
          // expect(res.data.products).toHaveLength(1)
          // expect(res.data.products).toEqual(
          //   expect.arrayContaining([expect.objectContaining({ id: prod1.id })])
          // )
          // res = await api.get(
          //   `/admin/products?discount_condition_id=${discountConditionId2}`,
          //   adminHeaders
          // )
          // expect(res.status).toEqual(200)
          // expect(res.data.products).toHaveLength(1)
          // expect(res.data.products).toEqual(
          //   expect.arrayContaining([expect.objectContaining({ id: prod2.id })])
          // )
          // res = await api.get(`/admin/products`, adminHeaders)
          // expect(res.status).toEqual(200)
          // expect(res.data.products).toHaveLength(5)
          // expect(res.data.products).toEqual(
          //   expect.arrayContaining([
          //     expect.objectContaining({ id: prod1.id }),
          //     expect.objectContaining({ id: prod2.id }),
          //   ])
          // )
        })

        it("doesn't expand collection and types", async () => {
          const notExpected = [
            expect.objectContaining({
              collection: expect.any(Object),
              type: expect.any(Object),
            }),
          ]

          // BREAKING: The expand query parameter is no longer supported, instead we use `fields`.
          const response = await api
            .get(
              `/admin/products?status[]=published,proposed&fields=id,status,*tags`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(2)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: proposedProduct.id,
                status: "proposed",
              }),
              expect.objectContaining({
                id: publishedProduct.id,
                status: "published",
              }),
            ])
          )

          for (const notExpect of notExpected) {
            expect(response.data.products).toEqual(
              expect.not.arrayContaining([notExpect])
            )
          }
        })

        it("returns a list of deleted products with free text query", async () => {
          // BREAKING: Comparison operators changed, so eg. `gt` became `$gt`
          const response = await api
            .get(
              `/admin/products?deleted_at[$gt]=01-26-1990&with_deleted=true&q=test`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.count).toEqual(1)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: deletedProduct.id,
              }),
            ])
          )
        })

        it("returns a list of products with free text query and limit", async () => {
          const response = await api
            .get("/admin/products?q=t&limit=2", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products.length).toEqual(2)
        })

        it("returns a list of products with free text query including variant prices", async () => {
          const response = await api
            .get(`/admin/products?q=${baseProduct.description}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const expectedVariantPrices = response.data.products[0].variants
            .map((v) => v.prices)
            .flat(1)

          expect(response.status).toEqual(200)
          expect(expectedVariantPrices).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: expect.stringMatching(/^price_*/),
              }),
              expect.objectContaining({
                id: expect.stringMatching(/^price_*/),
              }),
              expect.objectContaining({
                id: expect.stringMatching(/^price_*/),
              }),
            ])
          )
        })

        it("returns a list of products with free text query and offset", async () => {
          const response = await api
            .get("/admin/products?q=t&offset=1", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products.length).toEqual(2)
        })

        it("returns a list of deleted products", async () => {
          const response = await api
            .get(
              `/admin/products?deleted_at[$gt]=01-26-1990&with_deleted=true`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: deletedProduct.id,
              }),
            ])
          )
        })

        it("returns a list of products in collection", async () => {
          const notExpected = [
            expect.objectContaining({ collection_id: publishedCollection.id }),
          ]

          const response = await api
            .get(
              `/admin/products?collection_id[]=${baseCollection.id}`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                collection_id: baseCollection.id,
              }),
            ])
          )

          for (const notExpect of notExpected) {
            expect(response.data.products).toEqual(
              expect.not.arrayContaining([notExpect])
            )
          }
        })

        it("returns a list of products with tags", async () => {
          const response = await api.get(
            `/admin/products?tag_id[]=${baseProduct.tags[0].id}`,
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(2)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                tags: expect.arrayContaining([
                  expect.objectContaining({ id: baseProduct.tags[0].id }),
                ]),
              }),
              expect.objectContaining({
                id: publishedProduct.id,
                // It should be the same tag instance in both products
                tags: expect.arrayContaining([
                  expect.objectContaining({ id: baseProduct.tags[0].id }),
                ]),
              }),
            ])
          )
        })

        it("returns a list of products with tags in a collection", async () => {
          const response = await api.get(
            `/admin/products?collection_id[]=${baseCollection.id}&tag_id[]=${baseProduct.tags[0].id}`,
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                collection_id: baseCollection.id,
                tags: expect.arrayContaining([
                  expect.objectContaining({ id: baseProduct.tags[0].id }),
                ]),
              }),
            ])
          )
        })

        it("returns a list of products with only giftcard in list", async () => {
          const payload = {
            title: "Test Giftcard",
            is_giftcard: true,
            description: "test-giftcard-description",
            options: [{ title: "Denominations", values: ["100"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: {
                  Denominations: "100",
                },
              },
            ],
          }

          await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const response = await api
            .get("/admin/products?is_giftcard=true", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.data.products).toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({ is_giftcard: false }),
            ])
          )

          expect(response.status).toEqual(200)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                title: "Test Giftcard",
                id: expect.stringMatching(/^prod_*/),
                is_giftcard: true,
                description: "test-giftcard-description",
                // profile_id: expect.stringMatching(/^sp_*/),
                options: expect.arrayContaining([
                  expect.objectContaining({
                    title: "Denominations",
                    values: expect.arrayContaining([
                      expect.objectContaining({ value: "100" }),
                    ]),
                    id: expect.stringMatching(/^opt_*/),
                    product_id: expect.stringMatching(/^prod_*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  }),
                ]),
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    title: "Test variant",
                    id: expect.stringMatching(/^variant_*/),
                    product_id: expect.stringMatching(/^prod_*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                    prices: expect.arrayContaining([
                      expect.objectContaining({
                        id: expect.any(String),
                        currency_code: "usd",
                        amount: 100,
                        variant_id: expect.stringMatching(/^variant_*/),
                        created_at: expect.any(String),
                        updated_at: expect.any(String),
                      }),
                    ]),
                    options: expect.arrayContaining([
                      expect.objectContaining({
                        id: expect.stringMatching(/^optval_*/),
                        value: "100",
                      }),
                    ]),
                  }),
                ]),
                created_at: expect.any(String),
                updated_at: expect.any(String),
              }),
            ])
          )
        })

        it("returns a list of products not containing a giftcard in list", async () => {
          const payload = {
            title: "Test Giftcard",
            is_giftcard: true,
            description: "test-giftcard-description",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "x" },
              },
            ],
          }

          await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const response = await api
            .get("/admin/products?is_giftcard=false", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.data.products).toHaveLength(3)
          expect(response.data.products).toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({ is_giftcard: true }),
            ])
          )
        })

        it("returns a list of products with child entities", async () => {
          const response = await api
            .get("/admin/products?order=created_at", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.data.products).toHaveLength(3)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: baseProduct.id,
                options: expect.arrayContaining([
                  expect.objectContaining({
                    id: expect.stringMatching(/^opt_*/),
                    product_id: expect.stringMatching(/^prod_*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  }),
                ]),
                images: expect.arrayContaining([
                  expect.objectContaining({
                    id: expect.stringMatching(/^img_*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  }),
                ]),
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    id: baseProduct.variants[0].id,
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                    product_id: expect.stringMatching(/^prod_*/),
                    prices: expect.arrayContaining([
                      expect.objectContaining({
                        id: baseProduct.variants[0].prices[0].id,
                        variant_id: expect.stringMatching(/^variant_*/),
                        created_at: expect.any(String),
                        updated_at: expect.any(String),
                      }),
                    ]),
                    options: expect.arrayContaining([
                      expect.objectContaining({
                        id: expect.stringMatching(/^optval_*/),
                        value: "large",
                      }),
                    ]),
                  }),
                ]),
                tags: expect.arrayContaining([
                  expect.objectContaining({
                    id: expect.stringMatching(/^ptag_*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  }),
                ]),
                type: expect.objectContaining({
                  id: expect.stringMatching(/^ptyp_*/),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                collection: expect.objectContaining({
                  id: expect.stringMatching(/^pcol_*/),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                // // profile_id: expect.stringMatching(/^sp_*/),
                created_at: expect.any(String),
                updated_at: expect.any(String),
              }),
              expect.objectContaining({
                id: proposedProduct.id,
                created_at: expect.any(String),
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    id: proposedProduct.variants[0].id,
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                    product_id: expect.stringMatching(/^prod_*/),
                    options: expect.arrayContaining([
                      expect.objectContaining({
                        id: expect.stringMatching(/^optval_*/),
                        value: "green",
                      }),
                    ]),
                  }),
                ]),
                tags: expect.arrayContaining([
                  expect.objectContaining({
                    id: expect.stringMatching(/^ptag*/),
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  }),
                ]),
                type: expect.objectContaining({
                  id: expect.stringMatching(/^ptyp-*/),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                collection: null,
                // profile_id: expect.stringMatching(/^sp_*/),
                updated_at: expect.any(String),
              }),
              expect.objectContaining({
                id: publishedProduct.id,
                // profile_id: expect.stringMatching(/^sp_*/),
                created_at: expect.any(String),
                type: expect.any(Object),
                collection: expect.any(Object),
                options: expect.any(Array),
                tags: expect.any(Array),
                variants: expect.any(Array),
                updated_at: expect.any(String),
              }),
            ])
          )
        })

        // TODO: Enable through http
        it.skip("should return products filtered by price_list_id", async () => {
          // const priceList = await breaking(
          //   async () => {
          //     return await simplePriceListFactory(dbConnection, {
          //       prices: [
          //         {
          //           variant_id: baseProduct.variants[0].id,
          //           amount: 100,
          //           currency_code: "usd",
          //         },
          //       ],
          //     })
          //   },
          //   async () => {
          //     const variantId = baseProduct.variants[0].id
          //     const priceSet = await createVariantPriceSet({
          //       container,
          //       variantId,
          //     })
          //     const [priceList] = await pricingService.createPriceLists([
          //       {
          //         title: "Test price list",
          //         description: "Test",
          //         status: PriceListStatus.ACTIVE,
          //         type: PriceListType.OVERRIDE,
          //         prices: [
          //           {
          //             amount: 5000,
          //             currency_code: "usd",
          //             price_set_id: priceSet.id,
          //             rules: {
          //               region_id: "test-region",
          //             },
          //           },
          //         ],
          //       },
          //     ])
          //     return priceList
          //   }
          // )
          // const res = await api.get(
          //   `/admin/products?price_list_id[]=${priceList.id}`,
          //   adminHeaders
          // )
          // expect(res.status).toEqual(200)
          // expect(res.data.products.length).toEqual(1)
          // expect(res.data.products).toEqual([
          //   expect.objectContaining({
          //     id: baseProduct.id,
          //     status: baseProduct.status,
          //   }),
          // ])
        })

        it("should return products filtered by sales_channel_id", async () => {
          const salesChannel = (
            await api.post(
              "/admin/sales-channels",
              {
                name: "Sales",
              },
              adminHeaders
            )
          ).data.sales_channel

          const newProduct = (
            await api.post(
              "/admin/products",
              getProductFixture({
                title: "Test saleschannel",
                sales_channels: [{ id: salesChannel.id }],
                shipping_profile_id: shippingProfile.id,
              }),
              adminHeaders
            )
          ).data.product

          const res = await api.get(
            `/admin/products?sales_channel_id[]=${salesChannel.id}`,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.products.length).toEqual(1)
          expect(res.data.products).toEqual([
            expect.objectContaining({
              id: newProduct.id,
            }),
          ])
        })

        it("returns a list of products filtered by variants[ean]", async () => {
          const productWithEan = await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with EAN",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant",
                  ean: "1234567890123",
                  prices: [{ currency_code: "usd", amount: 100 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with different EAN",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant 2",
                  ean: "9876543210987",
                  prices: [{ currency_code: "usd", amount: 150 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          const response = await api
            .get("/admin/products?variants[ean]=1234567890123", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: productWithEan.data.product.id,
                title: "Product with EAN",
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    ean: "1234567890123",
                  }),
                ]),
              }),
            ])
          )
        })

        it("returns a list of products filtered by variants[upc]", async () => {
          const productWithUpc = await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with UPC",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant",
                  upc: "123456789012",
                  prices: [{ currency_code: "usd", amount: 200 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with different UPC",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant 2",
                  upc: "098765432109",
                  prices: [{ currency_code: "usd", amount: 250 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          const response = await api
            .get("/admin/products?variants[upc]=123456789012", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: productWithUpc.data.product.id,
                title: "Product with UPC",
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    upc: "123456789012",
                  }),
                ]),
              }),
            ])
          )
        })

        it("returns a list of products filtered by variants[barcode]", async () => {
          const productWithBarcode = await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with Barcode",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant",
                  barcode: "1234567890",
                  prices: [{ currency_code: "usd", amount: 300 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          await api.post(
            "/admin/products",
            getProductFixture({
              title: "Product with different Barcode",
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Test variant 2",
                  barcode: "0987654321",
                  prices: [{ currency_code: "usd", amount: 350 }],
                  options: {
                    size: "large",
                    color: "green",
                  },
                },
              ],
            }),
            adminHeaders
          )

          const response = await api
            .get("/admin/products?variants[barcode]=1234567890", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(1)
          expect(response.data.products).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: productWithBarcode.data.product.id,
                title: "Product with Barcode",
                variants: expect.arrayContaining([
                  expect.objectContaining({
                    barcode: "1234567890",
                  }),
                ]),
              }),
            ])
          )
        })

        it("returns empty list when filtering by non-existent variants[ean]", async () => {
          const response = await api
            .get("/admin/products?variants[ean]=5555555555555", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(0)
        })

        it("returns empty list when filtering by non-existent variants[upc]", async () => {
          const response = await api
            .get("/admin/products?variants[upc]=555555555555", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(0)
        })

        it("returns empty list when filtering by non-existent variants[barcode]", async () => {
          const response = await api
            .get("/admin/products?variants[barcode]=5555555555", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.products).toHaveLength(0)
        })
      })

      describe("GET /admin/products/:id", () => {
        it("should get a product with default relations", async () => {
          const res = await api
            .get(`/admin/products/${baseProduct.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const keysInResponse = Object.keys(res.data.product)

          expect(res.status).toEqual(200)
          expect(res.data.product.id).toEqual(baseProduct.id)
          expect(keysInResponse).toEqual(
            expect.arrayContaining([
              "id",
              "created_at",
              "updated_at",
              "deleted_at",
              "title",
              "subtitle",
              "description",
              "handle",
              "is_giftcard",
              "status",
              "thumbnail",
              "weight",
              "length",
              "height",
              "width",
              "hs_code",
              "origin_country",
              "mid_code",
              "material",
              "collection_id",
              "type_id",
              "discountable",
              "external_id",
              "metadata",
              // "categories",
              "collection",
              "images",
              "options",
              // "profiles",
              // "profile",
              // "profile_id",
              // "sales_channels",
              "tags",
              "type",
              "variants",
            ])
          )

          const variants = res.data.product.variants
          const hasPrices = variants.some((variant) => !!variant.prices)

          expect(hasPrices).toBe(true)
        })

        it("should get a product with images ordered by rank", async () => {
          const res = await api.get(
            `/admin/products/${baseProduct.id}`,
            adminHeaders
          )

          expect(res.data.product.images).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ url: "image-one", rank: 0 }),
              expect.objectContaining({ url: "image-two", rank: 1 }),
            ])
          )
        })

        it("should get a product with prices", async () => {
          const res = await api
            .get(
              `/admin/products/${baseProduct.id}?fields=*variants,*variants.prices`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          const { id, variants } = res.data.product

          expect(id).toEqual(baseProduct.id)
          expect(variants[0].prices).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                amount: 100,
                currency_code: "usd",
              }),
            ])
          )
        })

        it("should get a product only with variants expanded", async () => {
          const res = await api
            .get(
              `/admin/products/${baseProduct.id}?fields=title,*variants`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          const { id, variants } = res.data.product

          expect(id).toEqual(baseProduct.id)
          expect(variants[0]).toEqual(
            expect.objectContaining({
              title: "Test variant",
            })
          )
          // prices is one of many properties that should not be expanded
          expect(variants[0].prices).toBeUndefined()
        })
      })

      describe("GET /admin/products/:id/variants", () => {
        it("should get product variants with inventory quantity computed", async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "loc" },
              adminHeaders
            )
          ).data.stock_location

          const inventoryItem1 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-1" },
              adminHeaders
            )
          ).data.inventory_item

          const inventoryItem2 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-2" },
              adminHeaders
            )
          ).data.inventory_item

          await api.post(
            `/admin/inventory-items/${inventoryItem1.id}/location-levels`,
            {
              location_id: stockLocation.id,
              stocked_quantity: 8,
            },
            adminHeaders
          )

          await api.post(
            `/admin/inventory-items/${inventoryItem2.id}/location-levels`,
            {
              location_id: stockLocation.id,
              stocked_quantity: 4,
            },
            adminHeaders
          )

          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Custom inventory 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "x" },
                manage_inventory: true,
                inventory_items: [
                  {
                    inventory_item_id: inventoryItem1.id,
                    required_quantity: 4,
                  },
                  {
                    inventory_item_id: inventoryItem2.id,
                    required_quantity: 2,
                  },
                ],
              },
            ],
          }

          const product = (
            await api.post(`/admin/products`, payload, adminHeaders)
          ).data.product

          const variants = (
            await api.get(
              `/admin/products/${product.id}/variants?fields=+inventory_quantity`,
              adminHeaders
            )
          ).data.variants

          expect(variants).toEqual([
            expect.objectContaining({
              inventory_quantity: 2,
            }),
          ])
        })

        it("should get product variants filtered by manage_inventory", async () => {
          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Custom inventory 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: true,
                options: { size: "x" },
                inventory_items: [],
              },
              {
                title: "Custom inventory 2",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "l" },
                manage_inventory: false,
              },
            ],
          }

          const product = (
            await api.post(`/admin/products`, payload, adminHeaders)
          ).data.product

          let variants = (
            await api.get(
              `/admin/products/${product.id}/variants?manage_inventory=true`,
              adminHeaders
            )
          ).data.variants

          expect(variants).toEqual([
            expect.objectContaining({
              title: "Custom inventory 1",
              product_id: product.id,
            }),
          ])

          variants = (
            await api.get(
              `/admin/products/${product.id}/variants?manage_inventory=false`,
              adminHeaders
            )
          ).data.variants

          expect(variants).toEqual([
            expect.objectContaining({
              title: "Custom inventory 2",
              product_id: product.id,
            }),
          ])
        })
      })

      describe("POST /admin/products", () => {
        it("creates a product", async () => {
          const response = await api
            .post(
              "/admin/products",
              getProductFixture({
                title: "Test create",
                collection_id: baseCollection.id,
                type_id: baseType.id,
                tags: [{ id: baseTag1.id }, { id: baseTag2.id }],
                shipping_profile_id: shippingProfile.id,
              }),

              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          const priceIdSelector = /^price_*/

          expect(response.status).toEqual(200)
          expect(response.data.product).toEqual(
            expect.objectContaining({
              id: expect.stringMatching(/^prod_*/),
              title: "Test create",
              discountable: true,
              is_giftcard: false,
              handle: "test-create",
              status: "draft",
              created_at: expect.any(String),
              updated_at: expect.any(String),
              // profile_id: expect.stringMatching(/^sp_*/),
              images: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  url: "test-image.png",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                expect.objectContaining({
                  id: expect.any(String),
                  url: "test-image-2.png",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
              ]),
              thumbnail: "test-image.png",
              tags: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  value: "123",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                expect.objectContaining({
                  id: expect.any(String),
                  value: "456",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
              ]),
              type: expect.objectContaining({
                value: baseType.value,
                created_at: expect.any(String),
                updated_at: expect.any(String),
              }),
              collection: expect.objectContaining({
                id: baseCollection.id,
                title: baseCollection.title,
                created_at: expect.any(String),
                updated_at: expect.any(String),
              }),
              options: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.stringMatching(/^opt_*/),
                  product_id: expect.stringMatching(/^prod_*/),
                  title: "size",
                  values: expect.arrayContaining([
                    expect.objectContaining({ value: "large" }),
                  ]),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
                expect.objectContaining({
                  id: expect.stringMatching(/^opt_*/),
                  product_id: expect.stringMatching(/^prod_*/),
                  title: "color",
                  values: expect.arrayContaining([
                    expect.objectContaining({ value: "green" }),
                  ]),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                }),
              ]),
              variants: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.stringMatching(/^variant_*/),
                  product_id: expect.stringMatching(/^prod_*/),
                  updated_at: expect.any(String),
                  created_at: expect.any(String),
                  title: "Test variant",
                  prices: expect.arrayContaining([
                    expect.objectContaining({
                      id: expect.stringMatching(priceIdSelector),
                      currency_code: "usd",
                      amount: 100,
                      created_at: expect.any(String),
                      updated_at: expect.any(String),
                      variant_id: expect.stringMatching(/^variant_*/),
                    }),
                    expect.objectContaining({
                      id: expect.stringMatching(priceIdSelector),
                      currency_code: "eur",
                      amount: 45,
                      created_at: expect.any(String),
                      updated_at: expect.any(String),
                      variant_id: expect.stringMatching(/^variant_*/),
                    }),
                    expect.objectContaining({
                      id: expect.stringMatching(priceIdSelector),
                      currency_code: "dkk",
                      amount: 30,
                      created_at: expect.any(String),
                      updated_at: expect.any(String),
                      variant_id: expect.stringMatching(/^variant_*/),
                    }),
                  ]),
                  options: expect.arrayContaining([
                    expect.objectContaining({
                      id: expect.stringMatching(/^optval_*/),
                      value: "large",
                    }),
                    expect.objectContaining({
                      id: expect.stringMatching(/^optval_*/),
                      value: "green",
                    }),
                  ]),
                }),
              ]),
            })
          )
        })

        it("creates a product variant with price rules", async () => {
          const response = await api.post(
            "/admin/products",
            {
              title: "Test create",
              options: [{ title: "size", values: ["x", "l"] }],
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "Price with rules",
                  options: { size: "l" },
                  prices: [
                    {
                      currency_code: "usd",
                      amount: 100,
                      rules: { region_id: "eur" },
                    },
                  ],
                },
              ],
            },
            adminHeaders
          )

          const priceIdSelector = /^price_*/

          expect(response.status).toEqual(200)
          expect(response.data.product).toEqual(
            expect.objectContaining({
              id: expect.stringMatching(/^prod_*/),
              variants: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.stringMatching(/^variant_*/),
                  title: "Price with rules",
                  prices: expect.arrayContaining([
                    expect.objectContaining({
                      id: expect.stringMatching(priceIdSelector),
                      currency_code: "usd",
                      amount: 100,
                      created_at: expect.any(String),
                      updated_at: expect.any(String),
                      variant_id: expect.stringMatching(/^variant_*/),
                      rules: { region_id: "eur" },
                    }),
                  ]),
                }),
              ]),
            })
          )
        })

        it("creates a product that is not discountable", async () => {
          const payload = {
            title: "Test",
            discountable: false,
            description: "test-product-description",
            images: [{ url: "test-image.png" }, { url: "test-image-2.png" }],
            collection_id: baseCollection.id,
            tags: [{ id: baseTag1.id }, { id: baseTag2.id }],
            options: [{ title: "size", values: ["large"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "large" },
              },
            ],
          }

          const response = await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.product).toEqual(
            expect.objectContaining({
              discountable: false,
            })
          )
        })

        it.skip("Sets variant ranks when creating a product", async () => {
          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            description: "test-product-description 1",
            images: [{ url: "test-image.png" }, { url: "test-image-2.png" }],
            collection_id: baseCollection.id,
            tags: [{ id: baseTag1.id }, { id: baseTag2.id }],
            options: [{ title: "size", values: ["l", "x"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "x" },
              },
              {
                title: "Test variant 2",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "l" },
              },
            ],
          }

          const creationResponse = await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(creationResponse.status).toEqual(200)

          const productId = creationResponse.data.product.id

          const response = await api
            .get(`/admin/products/${productId}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.data.product).toEqual(
            expect.objectContaining({
              title: "Test product - 1",
              variants: [
                expect.objectContaining({
                  title: "Test variant 1",
                }),
                expect.objectContaining({
                  title: "Test variant 2",
                }),
              ],
            })
          )
        })

        it("creates a giftcard", async () => {
          const payload = {
            title: "Test Giftcard",
            is_giftcard: true,
            description: "test-giftcard-description",
            options: [{ title: "size", values: ["large"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "large" },
              },
            ],
          }

          const response = await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data.product).toEqual(
            expect.objectContaining({
              title: "Test Giftcard",
              discountable: false,
            })
          )
        })

        it("updates products with shipping profiles", async () => {
          const shippingProfile2 = (
            await api.post(
              `/admin/shipping-profiles`,
              { name: "heavy", type: "heavy" },
              adminHeaders
            )
          ).data.shipping_profile

          let fetchProduct = await api.get(
            `/admin/products/${baseProduct.id}?fields=+shipping_profile.id`,
            adminHeaders
          )

          let payload: Record<string, any> = {
            shipping_profile_id: shippingProfile2.id,
          }

          let response = await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          fetchProduct = await api.get(
            `/admin/products/${baseProduct.id}?fields=+shipping_profile.id`,
            adminHeaders
          )

          expect(fetchProduct.data.product.shipping_profile.id).toEqual(
            shippingProfile2.id
          )

          payload = {
            subtitle: "new subtitle",
          }

          response = await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          fetchProduct = await api.get(
            `/admin/products/${baseProduct.id}?fields=+shipping_profile.id`,
            adminHeaders
          )

          expect(fetchProduct.data.product.shipping_profile.id).toEqual(
            shippingProfile2.id
          )
        })

        it("updates a product (update prices, tags, update status, delete collection, delete type, replaces images)", async () => {
          const payload = {
            collection_id: null,
            title: "Test an update",
            variants: [
              {
                id: baseProduct.variants[0].id,
                title: "New variant",
                barcode: "test-barcode",
                ean: "test-ean",
                upc: "test-upc",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 200,
                  },
                  {
                    currency_code: "eur",
                    amount: 65,
                  },
                  {
                    currency_code: "dkk",
                    amount: 50,
                  },
                ],
              },
            ],
            tags: [{ id: baseTag1.id }],
            images: [{ url: "test-image-2.png" }],
            status: "published",
          }

          const response = await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data.product).toEqual(
            expect.objectContaining({
              id: baseProduct.id,
              title: "Test an update",
              created_at: expect.any(String),
              description: "test-product-description",
              discountable: true,
              // TODO: Do an update on the name, see if the handle is constant
              handle: "base-product",
              images: expect.arrayContaining([
                expect.objectContaining({
                  created_at: expect.any(String),
                  id: expect.stringMatching(/^img_*/),
                  updated_at: expect.any(String),
                  url: "test-image-2.png",
                }),
              ]),
              is_giftcard: false,
              options: expect.arrayContaining([
                expect.objectContaining({
                  created_at: expect.any(String),
                  id: expect.stringMatching(/^opt_*/),
                  product_id: baseProduct.id,
                  title: "size",
                  values: expect.arrayContaining([
                    expect.objectContaining({ value: "large" }),
                  ]),
                  updated_at: expect.any(String),
                }),
              ]),
              // // profile_id: expect.stringMatching(/^sp_*/),
              status: "published",
              tags: expect.arrayContaining([
                expect.objectContaining({
                  created_at: expect.any(String),
                  // TODO: Check how v1 tags update worked. Is it a full replacement, or something else? Why do we expect tag1 here?
                  // id: "tag1",
                  updated_at: expect.any(String),
                  value: "123",
                }),
              ]),
              // TODO: Decide how to handle the thumbnail on update
              // thumbnail: "test-image-2.png",
              type: expect.objectContaining({
                id: baseType.id,
                created_at: expect.any(String),
                updated_at: expect.any(String),
                value: baseType.value,
              }),
              type_id: baseType.id,
              updated_at: expect.any(String),
              variants: expect.arrayContaining([
                expect.objectContaining({
                  allow_backorder: false,
                  barcode: "test-barcode",
                  ean: "test-ean",
                  upc: "test-upc",
                  created_at: expect.any(String),
                  id: baseProduct.variants[0].id,
                  manage_inventory: true,
                  options: expect.arrayContaining([
                    expect.objectContaining({
                      id: expect.stringMatching(/^optval_*/),
                      value: "large",
                    }),
                  ]),
                  origin_country: null,
                  prices: expect.arrayContaining([
                    expect.objectContaining({
                      amount: 200,
                      created_at: expect.any(String),
                      currency_code: "usd",
                    }),
                    expect.objectContaining({
                      amount: 65,
                      created_at: expect.any(String),
                      currency_code: "eur",
                    }),
                    expect.objectContaining({
                      amount: 50,
                      created_at: expect.any(String),
                      currency_code: "dkk",
                    }),
                  ]),
                  product_id: baseProduct.id,
                  title: "New variant",
                  updated_at: expect.any(String),
                }),
              ]),
            })
          )
        })

        it("updates product variants (update price on existing variant, create new variant)", async () => {
          const payload = {
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                id: baseProduct.variants[0].id,
                prices: [
                  {
                    currency_code: "usd",
                    amount: 200,
                  },
                  {
                    currency_code: "dkk",
                    amount: 50,
                  },
                ],
              },
              {
                title: "New variant",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 150,
                  },
                  {
                    currency_code: "dkk",
                    amount: 20,
                  },
                ],
              },
            ],
          }

          const response = await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data.product).toEqual(
            expect.objectContaining({
              id: baseProduct.id,
              variants: expect.arrayContaining([
                expect.objectContaining({
                  id: baseProduct.variants[0].id,
                  prices: expect.arrayContaining([
                    expect.objectContaining({
                      amount: 200,
                      created_at: expect.any(String),
                      currency_code: "usd",
                    }),
                    expect.objectContaining({
                      amount: 50,
                      created_at: expect.any(String),
                      currency_code: "dkk",
                    }),
                  ]),
                  product_id: baseProduct.id,
                }),
                expect.objectContaining({
                  id: expect.any(String),
                  title: "New variant",
                  prices: expect.arrayContaining([
                    expect.objectContaining({
                      amount: 150,
                      created_at: expect.any(String),
                      currency_code: "usd",
                    }),
                    expect.objectContaining({
                      amount: 20,
                      created_at: expect.any(String),
                      currency_code: "dkk",
                    }),
                  ]),
                  product_id: baseProduct.id,
                }),
              ]),
            })
          )
        })

        it("updates product (removes images when empty array included)", async () => {
          const payload = {
            images: [],
          }

          const response = await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.product.images.length).toEqual(0)
        })

        it("updating the product without variants keeps the variants and prices intact", async () => {
          const payload = {
            title: "Test an update",
          }

          await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const updatedProduct = (
            await api.get(`/admin/products/${baseProduct.id}`, adminHeaders)
          ).data.product

          expect(updatedProduct.variants).toEqual([
            expect.objectContaining({
              id: baseProduct.variants[0].id,
              prices: expect.arrayContaining([
                expect.objectContaining({
                  currency_code: "usd",
                  amount: 100,
                }),
                expect.objectContaining({
                  currency_code: "eur",
                  amount: 45,
                }),
                expect.objectContaining({
                  currency_code: "dkk",
                  amount: 30,
                }),
              ]),
            }),
          ])
        })

        it("updating the product variants without prices keeps the prices intact", async () => {
          const payload = {
            title: "Test an update",
            variants: baseProduct.variants.map((variant) => ({
              id: variant.id,
              title: variant.id,
            })),
          }

          await api
            .post(`/admin/products/${baseProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          const updatedProduct = (
            await api.get(`/admin/products/${baseProduct.id}`, adminHeaders)
          ).data.product

          expect(updatedProduct.variants).toEqual([
            expect.objectContaining({
              id: baseProduct.variants[0].id,
              title: baseProduct.variants[0].id,
              prices: expect.arrayContaining([
                expect.objectContaining({
                  currency_code: "usd",
                  amount: 100,
                }),
                expect.objectContaining({
                  currency_code: "eur",
                  amount: 45,
                }),
                expect.objectContaining({
                  currency_code: "dkk",
                  amount: 30,
                }),
              ]),
            }),
          ])
        })

        it("updates a product by deleting a field from metadata", async () => {
          const created = (
            await api.post(
              "/admin/products",
              getProductFixture({
                title: "Test metadata",
                shipping_profile_id: shippingProfile.id,
                metadata: {
                  "test-key": "test-value",
                  "test-key-2": "test-value-2",
                  "test-key-3": "test-value-3",
                },
              }),
              adminHeaders
            )
          ).data.product

          const payload = {
            metadata: {
              "test-key": "", // item is deleted by setting to empty string
              "test-key-2": null,
            },
          }

          const response = await api.post(
            "/admin/products/" + created.id,
            payload,
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.product.metadata).toEqual({
            // "test-key" is deleted
            "test-key-2": null, // updated
            "test-key-3": "test-value-3", // preserved
          })
        })

        it("updates products sales channels", async () => {
          const salesChannel1 = (
            await api.post(
              "/admin/sales-channels",
              {
                name: "test name 1",
                description: "test description",
              },
              adminHeaders
            )
          ).data.sales_channel

          const salesChannel2 = (
            await api.post(
              "/admin/sales-channels",
              {
                name: "test name 2",
                description: "test description",
              },
              adminHeaders
            )
          ).data.sales_channel

          const newProduct = (
            await api.post(
              "/admin/products",
              getProductFixture({
                title: "Test saleschannel",
                sales_channels: [{ id: salesChannel1.id }],
                shipping_profile_id: shippingProfile.id,
              }),
              adminHeaders
            )
          ).data.product

          await api.post(
            `/admin/products/${newProduct.id}`,
            {
              title: "new name",
              sales_channels: [
                { id: salesChannel1.id },
                { id: salesChannel2.id },
              ],
            },
            adminHeaders
          )

          let res = await api.get(
            `/admin/products/${newProduct.id}?fields=*sales_channels`,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.product).toEqual(
            expect.objectContaining({
              id: newProduct.id,
              title: "new name",
              sales_channels: expect.arrayContaining([
                expect.objectContaining({
                  id: salesChannel1.id,
                  name: "test name 1",
                }),
                expect.objectContaining({
                  id: salesChannel2.id,
                  name: "test name 2",
                }),
              ]),
            })
          )

          await api.post(
            `/admin/products/${newProduct.id}`,
            {
              title: "new name 2",
              sales_channels: [{ id: salesChannel2.id }], // update channels again to remove the first one
            },
            adminHeaders
          )

          res = await api.get(
            `/admin/products/${newProduct.id}?fields=*sales_channels`,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.product).toEqual(
            expect.objectContaining({
              id: newProduct.id,
              title: "new name 2",
              sales_channels: expect.arrayContaining([
                expect.objectContaining({
                  id: salesChannel2.id,
                  name: "test name 2",
                }),
              ]),
            })
          )
        })

        it("updates multiple products that have the same sales channel", async () => {
          const salesChannel = (
            await api.post(
              "/admin/sales-channels",
              {
                name: "Sales",
              },
              adminHeaders
            )
          ).data.sales_channel

          await api.post(
            `/admin/products/${baseProduct.id}`,
            {
              sales_channels: [{ id: salesChannel.id }],
            },
            adminHeaders
          )
          await api.post(
            `/admin/products/${proposedProduct.id}`,
            {
              sales_channels: [{ id: salesChannel.id }],
            },
            adminHeaders
          )

          let res = await api.get(
            `/admin/products?fields=*sales_channels&sales_channel_id[]=${salesChannel.id}`,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual([
            expect.objectContaining({
              id: baseProduct.id,
              sales_channels: expect.arrayContaining([
                expect.objectContaining({
                  id: salesChannel.id,
                }),
              ]),
            }),
            expect.objectContaining({
              id: proposedProduct.id,
              sales_channels: expect.arrayContaining([
                expect.objectContaining({
                  id: salesChannel.id,
                }),
              ]),
            }),
          ])

          await api.post(
            `/admin/products/${proposedProduct.id}`,
            {
              sales_channels: [],
            },
            adminHeaders
          )

          res = await api.get(
            `/admin/products?fields=*sales_channels&sales_channel_id[]=${salesChannel.id}`,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.products).toEqual([
            expect.objectContaining({
              id: baseProduct.id,
              sales_channels: expect.arrayContaining([
                expect.objectContaining({
                  id: salesChannel.id,
                }),
              ]),
            }),
          ])
        })

        it("fails to update product with invalid status", async () => {
          const payload = {
            status: null,
          }

          try {
            await api.post(
              `/admin/products/${baseProduct}`,
              payload,
              adminHeaders
            )
          } catch (e) {
            expect(e.response.status).toEqual(400)
            expect(e.response.data.type).toEqual("invalid_data")
          }
        })

        // TODO: Apply variant ranking correctly
        it.skip("updates a product (variant ordering)", async () => {
          const plainProduct = (
            await api.post(
              "/admin/products",
              {
                title: "Test variant order",
                shipping_profile_id: shippingProfile.id,
              },
              adminHeaders
            )
          ).data.product

          const payload = {
            variants: [
              {
                title: "first",
              },
              {
                title: "second",
              },
              {
                title: "third",
              },
            ],
          }

          const response = await api
            .post(`/admin/products/${plainProduct.id}`, payload, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data.product).toEqual(
            expect.objectContaining({
              title: plainProduct.title,
              variants: [
                expect.objectContaining({
                  title: "first",
                }),
                expect.objectContaining({
                  title: "second",
                }),
                expect.objectContaining({
                  title: "third",
                }),
              ],
            })
          )
        })

        it("add option", async () => {
          const payload = {
            title: "should_add",
            values: ["100"],
          }

          const response = await api
            .post(
              `/admin/products/${baseProduct.id}/options`,
              payload,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data.product).toEqual(
            expect.objectContaining({
              options: expect.arrayContaining([
                expect.objectContaining({
                  title: "should_add",
                  product_id: baseProduct.id,
                  values: expect.arrayContaining([
                    expect.objectContaining({ value: "100" }),
                  ]),
                }),
              ]),
            })
          )
        })

        it("creates product with variant inventory kits", async () => {
          const inventoryItem1 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-1" },
              adminHeaders
            )
          ).data.inventory_item

          const inventoryItem2 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-2" },
              adminHeaders
            )
          ).data.inventory_item

          const inventoryItem3 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-3" },
              adminHeaders
            )
          ).data.inventory_item

          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Custom inventory 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: true,
                options: { size: "l" },
                inventory_items: [
                  {
                    inventory_item_id: inventoryItem1.id,
                    required_quantity: 4,
                  },
                ],
              },
              {
                title: "No inventory",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: false,
              },
              {
                title: "Default Inventory",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: true,
              },
              {
                title: "Custom inventory 2",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: true,
                inventory_items: [
                  {
                    inventory_item_id: inventoryItem2.id,
                    required_quantity: 5,
                  },
                  {
                    inventory_item_id: inventoryItem3.id,
                    required_quantity: 6,
                  },
                ],
              },
            ],
          }

          const response = await api
            .post(
              "/admin/products?fields=%2bvariants.inventory_items.inventory.*,%2bvariants.inventory_items.*",
              payload,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.product).toEqual(
            expect.objectContaining({
              title: "Test product - 1",
              variants: expect.arrayContaining([
                expect.objectContaining({
                  title: "Custom inventory 1",
                  manage_inventory: true,
                  inventory_items: [
                    expect.objectContaining({
                      required_quantity: 4,
                      inventory_item_id: inventoryItem1.id,
                    }),
                  ],
                }),
                expect.objectContaining({
                  title: "No inventory",
                  manage_inventory: false,
                  inventory_items: [],
                }),
                expect.objectContaining({
                  title: "Default Inventory",
                  manage_inventory: true,
                  inventory_items: [
                    expect.objectContaining({
                      required_quantity: 1,
                      inventory_item_id: expect.any(String),
                    }),
                  ],
                }),
                expect.objectContaining({
                  title: "Custom inventory 2",
                  manage_inventory: true,
                  inventory_items: expect.arrayContaining([
                    expect.objectContaining({
                      required_quantity: 5,
                      inventory_item_id: inventoryItem2.id,
                    }),
                    expect.objectContaining({
                      required_quantity: 6,
                      inventory_item_id: inventoryItem3.id,
                    }),
                  ]),
                }),
              ]),
            })
          )
        })

        it("creates throw when duplicated inventory items", async () => {
          const inventoryItem1 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-1" },
              adminHeaders
            )
          ).data.inventory_item

          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Custom inventory 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "l" },
                manage_inventory: true,
                inventory_items: [
                  {
                    inventory_item_id: inventoryItem1.id,
                    required_quantity: 4,
                  },
                  {
                    inventory_item_id: inventoryItem1.id,
                    required_quantity: 2,
                  },
                ],
              },
              {
                title: "No inventory",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: false,
              },
              {
                title: "Default Inventory",
                prices: [{ currency_code: "usd", amount: 100 }],
                manage_inventory: true,
              },
            ],
          }

          const error = await api
            .post(
              "/admin/products?fields=%2bvariants.inventory_items.inventory.*,%2bvariants.inventory_items.*",
              payload,
              adminHeaders
            )
            .catch((err) => err)

          expect(error.response.status).toEqual(400)
          expect(error.response.data.message).toMatch(
            new RegExp(
              "Cannot associate duplicate inventory items to variant\\(s\\) \\w+"
            )
          )
        })

        it("should throw an error when inventory item does not exist", async () => {
          const payload = {
            title: "Test product - 1",
            handle: "test-1",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Custom inventory 1",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "l" },
                manage_inventory: true,
                inventory_items: [
                  {
                    inventory_item_id: "does-not-exist",
                    required_quantity: 4,
                  },
                ],
              },
            ],
          }

          const error = await api
            .post("/admin/products", payload, adminHeaders)
            .catch((err) => err)

          expect(error.response.status).toEqual(400)
          expect(error.response.data).toEqual(
            expect.objectContaining({
              type: "invalid_data",
              message: "Inventory Items with ids: does-not-exist was not found",
            })
          )
        })
      })

      describe("DELETE /admin/products/:id/options/:option_id", () => {
        it("deletes a product option", async () => {
          const response = await api
            .delete(
              `/admin/products/${baseProduct.id}/options/${baseProduct.options[0].id}`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          // BREAKING: Delete response changed from returning the deleted product to the current DeleteResponse model
          expect(response.data).toEqual(
            expect.objectContaining({
              id: baseProduct.options[0].id,
              object: "product_option",
              parent: expect.objectContaining({
                id: baseProduct.id,
              }),
            })
          )
        })

        // TODO: This is failing, investigate
        it.skip("deletes a values associated with deleted option", async () => {
          await api.delete(
            `/admin/products/${baseProduct.id}/options/${baseProduct.options[0].id}`,
            adminHeaders
          )

          const optionsRes = await api.get(
            `/admin/products/${baseProduct.id}/options?deleted_at[$gt]=01-26-1990`,
            adminHeaders
          )

          expect(optionsRes.data.product_options).toEqual([
            expect.objectContaining({ deleted_at: expect.any(Date) }),
          ])
        })
      })

      describe("testing for soft-deletion + uniqueness on handles, collection and variant properties", () => {
        it("successfully deletes a product", async () => {
          const response = await api
            .delete(`/admin/products/${baseProduct.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data).toEqual(
            expect.objectContaining({
              id: baseProduct.id,
              deleted: true,
            })
          )
        })

        it("successfully deletes a product and variants", async () => {
          const variantPre = (
            await api.get(
              `/admin/products/${baseProduct.id}/variants/${baseProduct.variants[0].id}`,
              adminHeaders
            )
          ).data.variant

          expect(variantPre).toBeTruthy()

          const response = await api
            .delete(`/admin/products/${baseProduct.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)

          expect(response.data).toEqual(
            expect.objectContaining({
              id: baseProduct.id,
              deleted: true,
            })
          )
          const variantPost = (
            await api.get(
              `/admin/products/${baseProduct.id}/variants/${baseProduct.variants[0].id}`,
              adminHeaders
            )
          ).data.variant

          expect(variantPost).not.toBeTruthy()
        })

        it("deletes product and inventory items that are only associated with that product's variants", async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "loc" },
              adminHeaders
            )
          ).data.stock_location

          const inventoryItem1 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-1" },
              adminHeaders
            )
          ).data.inventory_item

          const inventoryItem2 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-2-reused-across-products" },
              adminHeaders
            )
          ).data.inventory_item

          await api.post(
            `/admin/inventory-items/${inventoryItem1.id}/location-levels`,
            {
              location_id: stockLocation.id,
              stocked_quantity: 8,
            },
            adminHeaders
          )

          await api.post(
            `/admin/inventory-items/${inventoryItem2.id}/location-levels`,
            {
              location_id: stockLocation.id,
              stocked_quantity: 4,
            },
            adminHeaders
          )

          const productWithInventoryItems = (
            await api.post(
              `/admin/products`,
              {
                title: "Test product - 1",
                handle: "test-1",
                options: [{ title: "size", values: ["l"] }],
                shipping_profile_id: shippingProfile.id,
                variants: [
                  {
                    title: "Custom inventory 1",
                    prices: [{ currency_code: "usd", amount: 100 }],
                    manage_inventory: true,
                    options: { size: "l" },
                    inventory_items: [
                      {
                        inventory_item_id: inventoryItem1.id,
                        required_quantity: 4,
                      },
                      {
                        inventory_item_id: inventoryItem2.id,
                        required_quantity: 2,
                      },
                    ],
                  },
                ],
              },
              adminHeaders
            )
          ).data.product

          // Another product that shares inventory item in the inventory kit
          await api.post(
            `/admin/products`,
            {
              title: "Test product - 2",
              handle: "test-2",
              options: [{ title: "size", values: ["l"] }],
              shipping_profile_id: shippingProfile.id,
              variants: [
                {
                  title: "W/ shared inventory item",
                  prices: [{ currency_code: "usd", amount: 100 }],
                  manage_inventory: true,
                  options: { size: "l" },
                  inventory_items: [
                    {
                      inventory_item_id: inventoryItem2.id,
                      required_quantity: 2,
                    },
                  ],
                },
              ],
            },
            adminHeaders
          )

          const response = await api
            .delete(
              `/admin/products/${productWithInventoryItems.id}`,
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data).toEqual(
            expect.objectContaining({ deleted: true })
          )

          const item1Response = await api
            .get(`/admin/inventory-items/${inventoryItem1.id}`, adminHeaders)
            .catch((err) => {
              return err.response
            })

          const item2Response = await api
            .get(`/admin/inventory-items/${inventoryItem2.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(item1Response.status).toEqual(404) // deleted since it's used only by the deleted product
          expect(item2Response.status).toEqual(200) // not deleted since it belongs to other products
          expect(item2Response.data.inventory_item).toEqual(
            expect.objectContaining({ id: inventoryItem2.id })
          )
        })

        it("should throw if product that has a reservation is being deleted", async () => {
          const stockLocation = (
            await api.post(
              `/admin/stock-locations`,
              { name: "loc" },
              adminHeaders
            )
          ).data.stock_location

          const inventoryItem1 = (
            await api.post(
              `/admin/inventory-items`,
              { sku: "inventory-1" },
              adminHeaders
            )
          ).data.inventory_item

          await api.post(
            `/admin/inventory-items/${inventoryItem1.id}/location-levels`,
            {
              location_id: stockLocation.id,
              stocked_quantity: 8,
            },
            adminHeaders
          )

          const productWithInventoryItems = (
            await api.post(
              `/admin/products`,
              {
                title: "Test product - 1",
                handle: "test-1",
                options: [{ title: "size", values: ["l"] }],
                shipping_profile_id: shippingProfile.id,
                variants: [
                  {
                    title: "Custom inventory 1",
                    prices: [{ currency_code: "usd", amount: 100 }],
                    manage_inventory: true,
                    options: { size: "l" },
                    inventory_items: [
                      {
                        inventory_item_id: inventoryItem1.id,
                        required_quantity: 4,
                      },
                    ],
                  },
                ],
              },
              adminHeaders
            )
          ).data.product

          const reservation = (
            await api.post(
              `/admin/reservations`,
              {
                line_item_id: "line-item-id-1",
                inventory_item_id: inventoryItem1.id,
                location_id: stockLocation.id,
                description: "test description",
                quantity: 1,
              },
              adminHeaders
            )
          ).data.reservation

          const response = await api
            .delete(
              `/admin/products/${productWithInventoryItems.id}`,
              adminHeaders
            )
            .catch((err) => {
              return err.response
            })

          expect(response.status).toEqual(400)
          expect(response.data.message).toEqual(
            `Cannot remove following inventory item(s) since they have reservations: [${inventoryItem1.id}].`
          )
        })

        // TODO: Enable with http calls
        it.skip("successfully deletes a product variant and its associated prices", async () => {
          // // Validate that the price exists
          // const pricePre = await dbConnection.manager.findOne(MoneyAmount, {
          //   where: { id: "test-price" },
          // })
          // expect(pricePre).toBeTruthy()
          // // Soft delete the variant
          // const response = await api.delete(
          //   "/admin/products/test-product/variants/test-variant",
          //   adminHeaders
          // )
          // expect(response.status).toEqual(200)
          // // Validate that the price was deleted
          // const pricePost = await dbConnection.manager.findOne(MoneyAmount, {
          //   where: { id: "test-price" },
          // })
          // expect(pricePost).not.toBeTruthy()
          // // Validate that the price still exists in the DB with deleted_at
          // const optValDeleted = await dbConnection.manager.findOne(
          //   MoneyAmount,
          //   {
          //     where: {
          //       id: "test-price",
          //     },
          //     withDeleted: true,
          //   }
          // )
          // expect(optValDeleted).toEqual(
          //   expect.objectContaining({
          //     deleted_at: expect.any(Date),
          //     id: "test-price",
          //   })
          // )
        })

        // TODO: Enable with http calls
        it.skip("successfully deletes a product and any prices associated with one of its variants", async () => {
          // // Validate that the price exists
          // const pricePre = await dbConnection.manager.findOne(MoneyAmount, {
          //   where: { id: "test-price" },
          // })
          // expect(pricePre).toBeTruthy()
          // // Soft delete the product
          // const response = await api.delete(
          //   "/admin/products/test-product",
          //   adminHeaders
          // )
          // expect(response.status).toEqual(200)
          // // Validate that the price has been deleted
          // const pricePost = await dbConnection.manager.findOne(MoneyAmount, {
          //   where: { id: "test-price" },
          // })
          // expect(pricePost).not.toBeTruthy()
          // // Validate that the price still exists in the DB with deleted_at
          // const optValDeleted = await dbConnection.manager.findOne(
          //   MoneyAmount,
          //   {
          //     where: {
          //       id: "test-price",
          //     },
          //     withDeleted: true,
          //   }
          // )
          // expect(optValDeleted).toEqual(
          //   expect.objectContaining({
          //     deleted_at: expect.any(Date),
          //     id: "test-price",
          //   })
          // )
        })

        it("successfully creates product with soft-deleted product handle and deletes it again", async () => {
          // First we soft-delete the product
          const response = await api
            .delete(`/admin/products/${baseProduct.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.id).toEqual(baseProduct.id)

          // Lets try to create a product with same handle as deleted one
          const payload = {
            title: baseProduct.title,
            handle: baseProduct.handle,
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "x" },
              },
            ],
          }

          const res = await api.post("/admin/products", payload, adminHeaders)

          expect(res.status).toEqual(200)
          expect(res.data.product.handle).toEqual(baseProduct.handle)

          // Delete product again to ensure uniqueness is enforced in all cases
          const response2 = await api
            .delete(`/admin/products/${res.data.product.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response2.status).toEqual(200)
          expect(response2.data.id).toEqual(res.data.product.id)
        })

        it("should fail when creating a product with a handle that already exists", async () => {
          // Lets try to create a product with same handle as deleted one
          const payload = {
            title: baseProduct.title,
            handle: baseProduct.handle,
            description: "test-product-description",
            options: [{ title: "size", values: ["x", "l"] }],
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Test variant",
                prices: [{ currency_code: "usd", amount: 100 }],
                options: { size: "x" },
              },
            ],
          }

          try {
            await api.post("/admin/products", payload, adminHeaders)
          } catch (error) {
            expect(error.response.data.message).toMatch(
              "Product with handle: base-product, already exists."
            )
          }
        })

        it("successfully deletes product collection", async () => {
          // First we soft-delete the product collection
          const response = await api
            .delete(`/admin/collections/${baseCollection.id}`, adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(response.status).toEqual(200)
          expect(response.data.id).toEqual(baseCollection.id)
        })

        it("successfully creates soft-deleted product collection", async () => {
          const response = await api.delete(
            `/admin/collections/${baseCollection.id}`,
            adminHeaders
          )
          expect(response.status).toEqual(200)
          expect(response.data.id).toEqual(baseCollection.id)

          // Lets try to create a product collection with same handle as deleted one
          const payload = {
            title: "Another test collection",
            handle: baseCollection.handle,
          }

          const res = await api.post(
            "/admin/collections",
            payload,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.collection.handle).toEqual(baseCollection.handle)
        })

        it("should fail when creating a collection with a handle that already exists", async () => {
          // Lets try to create a collection with same handle as deleted one
          const payload = {
            title: "Another test collection",
            handle: baseCollection.handle,
          }

          try {
            await api.post("/admin/collections", payload, adminHeaders)
          } catch (error) {
            expect(error.response.data.message).toMatch(
              `Product collection with handle: ${baseCollection.handle}, already exists.`
            )
          }
        })

        it("successfully creates soft-deleted product variant", async () => {
          const variant = baseProduct.variants[0]
          const response = await api.delete(
            `/admin/products/${baseProduct.id}/variants/${variant.id}`,
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.id).toEqual(baseProduct.variants[0].id)

          const payload = {
            title: "Second variant",
            sku: "new-sku",
            ean: "new-ean",
            upc: "new-upc",
            barcode: "new-barcode",
            prices: [
              {
                currency_code: "usd",
                amount: 100,
              },
            ],
          }

          const res = await api.post(
            `/admin/products/${baseProduct.id}/variants`,
            payload,
            adminHeaders
          )

          expect(res.status).toEqual(200)
          expect(res.data.product.variants).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                title: "Second variant",
                sku: "new-sku",
                ean: "new-ean",
                upc: "new-upc",
                barcode: "new-barcode",
              }),
            ])
          )
        })
      })

      describe("POST /admin/products/:id/variants/:id", () => {
        it("successfully updates variant without prices", async () => {
          const res = await api
            .post(
              `/admin/products/${baseProduct.id}/variants/${baseProduct.variants[0].id}`,
              {
                title: "Updated variant",
              },
              adminHeaders
            )
            .catch((err) => {
              console.log(err)
            })

          expect(res.status).toEqual(200)
          expect(
            res.data.product.variants.find(
              (v) => v.id === baseProduct.variants[0].id
            )?.title
          ).toEqual("Updated variant")
        })

        it("updates multiple options in the same call", async () => {
          const baseVariant = baseProduct.variants[0]
          const updatedProduct = (
            await api.post(
              `/admin/products/${baseProduct.id}/variants/${baseVariant.id}`,
              {
                title: "Updated variant",
                options: {
                  size: "small",
                  color: "green",
                },
              },
              adminHeaders
            )
          ).data.product

          const updatedOptions = updatedProduct.variants.find(
            (v) => v.id === baseVariant.id
          ).options

          expect(updatedOptions).toHaveLength(2)
          expect(updatedOptions).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                value: "small",
              }),
              expect.objectContaining({
                value: "green",
              }),
            ])
          )
        })
      })

      describe("batch methods", () => {
        it("successfully creates, updates, and deletes products", async () => {
          const createPayload = getProductFixture({
            weight: 100,
            length: 200,
            height: 300,
            width: 400,
            title: "Test batch create",
            handle: "test-batch-create",
            shipping_profile_id: shippingProfile.id,
          })

          const updatePayload = {
            weight: 101,
            length: 201,
            height: 301,
            width: 401,
            id: publishedProduct.id,
            title: "Test batch update",
          }

          const response = await api.post(
            "/admin/products/batch",
            {
              create: [createPayload],
              update: [updatePayload],
              delete: [baseProduct.id],
            },
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.created).toHaveLength(1)
          expect(response.data.updated).toHaveLength(1)
          expect(response.data.deleted.ids).toHaveLength(1)

          expect(response.data.created).toEqual([
            expect.objectContaining({
              title: "Test batch create",
            }),
          ])

          expect(response.data.updated).toEqual([
            expect.objectContaining({
              title: "Test batch update",
            }),
          ])

          expect(response.data.deleted).toEqual(
            expect.objectContaining({ ids: [baseProduct.id] })
          )

          const dbData = (await api.get("/admin/products", adminHeaders)).data
            .products

          expect(dbData).toHaveLength(3)
          expect(dbData).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                title: "Test batch create",
              }),
              expect.objectContaining({
                title: "Test batch update",
              }),
            ])
          )
        })

        it("should successfully delete products", async () => {
          const response = await api.post(
            "/admin/products/batch",
            { delete: [baseProduct.id] },
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.created).toHaveLength(0)
          expect(response.data.updated).toHaveLength(0)
          expect(response.data.deleted.ids).toHaveLength(1)

          expect(response.data.created).toEqual([])
          expect(response.data.updated).toEqual([])
          expect(response.data.deleted).toEqual(
            expect.objectContaining({ ids: [baseProduct.id] })
          )
        })

        it("successfully creates, updates, and deletes product variants", async () => {
          const productWithMultipleVariants = getProductFixture({
            title: "Test batch variants",
            handle: "test-batch-variants",
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Variant 1",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 100,
                  },
                ],
              },
              {
                title: "Variant 2",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 200,
                  },
                ],
              },
            ],
          })

          const createdProduct = (
            await api.post(
              "/admin/products",
              productWithMultipleVariants,
              adminHeaders
            )
          ).data.product

          const createPayload = {
            title: "Test batch create variant",
            prices: [
              {
                currency_code: "usd",
                amount: 20,
              },
              {
                currency_code: "dkk",
                amount: 10,
              },
            ],
          }

          const updatePayload = {
            id: createdProduct.variants[0].id,
            title: "Test batch update variant",
          }

          const response = await api.post(
            `/admin/products/${createdProduct.id}/variants/batch`,
            {
              create: [createPayload],
              update: [updatePayload],
              delete: [createdProduct.variants[1].id],
            },
            adminHeaders
          )

          const dbData = (
            await api.get(`/admin/products/${createdProduct.id}`, adminHeaders)
          ).data.product.variants

          expect(response.status).toEqual(200)
          expect(dbData).toHaveLength(2)
          expect(dbData).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                title: "Test batch create variant",
              }),
              expect.objectContaining({
                title: "Test batch update variant",
              }),
            ])
          )
        })

        it("should preserve variant prices when batch updating variants", async () => {
          const productWithMultipleVariants = getProductFixture({
            title: "Test batch variants",
            handle: "test-batch-variants",
            shipping_profile_id: shippingProfile.id,
            variants: [
              {
                title: "Variant 1",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 100,
                  },
                ],
              },
              {
                title: "Variant 2",
                prices: [
                  {
                    currency_code: "usd",
                    amount: 200,
                  },
                ],
              },
            ],
          })

          const createdProduct = (
            await api.post(
              "/admin/products",
              productWithMultipleVariants,
              adminHeaders
            )
          ).data.product

          const variant1Id = createdProduct.variants.find(
            (v) => v.title === "Variant 1"
          ).id

          const variant2Id = createdProduct.variants.find(
            (v) => v.title === "Variant 2"
          ).id

          const updatePayload1 = {
            id: variant1Id,
            title: "Test batch update variant",
          }

          const updatePayload2 = {
            id: variant2Id,
            prices: [{ currency_code: "usd", amount: 300 }],
          }

          const response = await api.post(
            `/admin/products/${createdProduct.id}/variants/batch`,
            {
              update: [updatePayload1, updatePayload2],
            },
            adminHeaders
          )

          const dbData = (
            await api.get(
              `/admin/products/${createdProduct.id}?fields=*variants.prices`,
              adminHeaders
            )
          ).data.product.variants

          expect(response.status).toEqual(200)
          expect(dbData).toHaveLength(2)
          expect(dbData).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: variant1Id,
                title: "Test batch update variant",
                prices: expect.arrayContaining([
                  // updated title but price remains the same
                  expect.objectContaining({
                    currency_code: "usd",
                    amount: 100,
                  }),
                ]),
              }),
              expect.objectContaining({
                id: variant2Id,
                prices: expect.arrayContaining([
                  expect.objectContaining({
                    // updated price
                    currency_code: "usd",
                    amount: 300,
                  }),
                ]),
              }),
            ])
          )
        })

        it("successfully adds and removes products to a collection", async () => {
          const response = await api.post(
            `/admin/collections/${baseCollection.id}/products`,
            {
              add: [publishedProduct.id],
              remove: [baseProduct.id],
            },
            adminHeaders
          )

          expect(response.status).toEqual(200)
          expect(response.data.collection).toBeTruthy()

          const collection = (
            await api.get(
              `/admin/collections/${baseCollection.id}?fields=*products`,
              adminHeaders
            )
          ).data.collection

          expect(collection.products).toHaveLength(1)
          expect(collection.products[0]).toEqual(
            expect.objectContaining({
              id: publishedProduct.id,
            })
          )
        })

        // https://linear.app/medusajs/issue/SUP-1631/price-differences
        it("should successfully handle successive updates on prices", async () => {
          const response = await api.post(
            "/admin/products/batch",
            {
              create: [
                getProductFixture({
                  title: "title1",
                  variants: [
                    {
                      title: "variant1",
                      prices: [{ currency_code: "usd", amount: 100 }],
                    },
                  ],
                }),
                getProductFixture({
                  title: "title2",
                  variants: [
                    {
                      title: "variant2",
                      prices: [{ currency_code: "usd", amount: 200 }],
                    },
                  ],
                }),
                getProductFixture({
                  title: "title3",
                  variants: [
                    {
                      title: "variant3",
                      prices: [{ currency_code: "usd", amount: 300 }],
                    },
                  ],
                }),
              ],
              update: [],
              delete: [baseProduct.id],
            },
            adminHeaders
          )
          const created = response.data.created
          const created1 = created.find((p) => p.title === "title1")
          const created2 = created.find((p) => p.title === "title2")
          const created3 = created.find((p) => p.title === "title3")

          // Update the first and third product price to shuffle their order in the DB
          await api.post(
            `/admin/products/batch`,
            {
              update: [
                {
                  id: created1.id,
                  variants: [
                    {
                      id: created1.variants[0].id,
                      prices: [{ currency_code: "usd", amount: 101 }],
                    },
                  ],
                },
                {
                  id: created3.id,
                  variants: [
                    {
                      id: created3.variants[0].id,
                      prices: [{ currency_code: "usd", amount: 301 }],
                    },
                  ],
                },
              ],
            },
            adminHeaders
          )

          // Update all products now
          await api.post(
            `/admin/products/batch`,
            {
              update: [
                {
                  id: created1.id,
                  variants: [
                    {
                      id: created1.variants[0].id,
                      prices: [{ currency_code: "usd", amount: 102 }],
                    },
                  ],
                },
                {
                  id: created2.id,
                  variants: [
                    {
                      id: created2.variants[0].id,
                      prices: [{ currency_code: "usd", amount: 202 }],
                    },
                  ],
                },
                {
                  id: created3.id,
                  variants: [
                    {
                      id: created3.variants[0].id,
                      prices: [{ currency_code: "usd", amount: 302 }],
                    },
                  ],
                },
              ],
            },
            adminHeaders
          )

          // Get the first product
          const product1 = (
            await api.get(`/admin/products/${created1.id}`, adminHeaders)
          ).data.product
          const product2 = (
            await api.get(`/admin/products/${created2.id}`, adminHeaders)
          ).data.product
          const product3 = (
            await api.get(`/admin/products/${created3.id}`, adminHeaders)
          ).data.product
          expect(product1.variants[0].prices[0].amount).toEqual(102)
          expect(product2.variants[0].prices[0].amount).toEqual(202)
          expect(product3.variants[0].prices[0].amount).toEqual(302)
        })
      })

      // TODO: Discuss how this should be handled
      describe.skip("GET /admin/products/tag-usage", () => {
        it("successfully gets the tags usage", async () => {
          const res = await api
            .get("/admin/products/tag-usage", adminHeaders)
            .catch((err) => {
              console.log(err)
            })

          expect(res.status).toEqual(200)
          expect(res.data.tags.length).toEqual(3)
          expect(res.data.tags).toEqual(
            expect.arrayContaining([
              { id: "tag1", usage_count: "2", value: "123" },
              { id: "tag3", usage_count: "2", value: "1235" },
              { id: "tag4", usage_count: "1", value: "1234" },
            ])
          )
        })
      })
    })
  },
})
