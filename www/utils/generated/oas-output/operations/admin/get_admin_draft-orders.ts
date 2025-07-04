/**
 * @oas [get] /admin/draft-orders
 * operationId: GetDraftOrders
 * summary: List Draft Orders
 * description: Retrieve a list of draft orders. The draft orders can be filtered by fields such as `id`. The draft orders can also be sorted or paginated.
 * x-authenticated: true
 * parameters:
 *   - name: fields
 *     in: query
 *     description: Comma-separated fields that should be included in the returned data. if a field is prefixed with `+` it will be added to the default fields, using `-` will remove it from the default
 *       fields. without prefix it will replace the entire default fields.
 *     required: false
 *     schema:
 *       type: string
 *       title: fields
 *       description: Comma-separated fields that should be included in the returned data. if a field is prefixed with `+` it will be added to the default fields, using `-` will remove it from the default
 *         fields. without prefix it will replace the entire default fields.
 *       externalDocs:
 *         url: "#select-fields-and-relations"
 *   - name: offset
 *     in: query
 *     description: The number of items to skip when retrieving a list.
 *     required: false
 *     schema:
 *       type: number
 *       title: offset
 *       description: The number of items to skip when retrieving a list.
 *       externalDocs:
 *         url: "#pagination"
 *   - name: limit
 *     in: query
 *     description: Limit the number of items returned in the list.
 *     required: false
 *     schema:
 *       type: number
 *       title: limit
 *       description: Limit the number of items returned in the list.
 *       externalDocs:
 *         url: "#pagination"
 *   - name: order
 *     in: query
 *     description: The field to sort the data by. By default, the sort order is ascending. To change the order to descending, prefix the field name with `-`.
 *     required: false
 *     schema:
 *       type: string
 *       title: order
 *       description: The field to sort the data by. By default, the sort order is ascending. To change the order to descending, prefix the field name with `-`.
 *   - name: id
 *     in: query
 *     required: false
 *     schema:
 *       oneOf:
 *         - type: string
 *           title: id
 *           description: Filter by a draft order's ID.
 *         - type: array
 *           description: Filter by draft order IDs.
 *           items:
 *             type: string
 *             title: id
 *             description: A draft order's ID.
 *         - type: object
 *           description: Filter by conditions on the draft order's ID.
 *           properties:
 *             $and:
 *               type: array
 *               description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *               items:
 *                 type: object
 *               title: $and
 *             $or:
 *               type: array
 *               description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *               items:
 *                 type: object
 *               title: $or
 *             $eq:
 *               oneOf:
 *                 - type: string
 *                   title: $eq
 *                   description: Filter by an exact match.
 *                 - type: array
 *                   description: Filter by exact matches.
 *                   items:
 *                     type: string
 *                     title: $eq
 *                     description: Filter by an exact match.
 *                 - type: array
 *                   description: Filter by exact matches.
 *                   items:
 *                     oneOf:
 *                       - type: string
 *                         title: $eq
 *                         description: Filter by an exact match.
 *                       - type: array
 *                         description: Filter by exact matches.
 *                         items:
 *                           type: string
 *                           title: $eq
 *                           description: Filter by an exact match.
 *             $ne:
 *               oneOf:
 *                 - type: string
 *                   title: $ne
 *                   description: Filter by values not equal to this parameter.
 *                 - type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $ne
 *                     description: Filter by values not equal to this parameter.
 *             $in:
 *               type: array
 *               description: Filter by values in this array.
 *               items:
 *                 oneOf:
 *                   - type: string
 *                     title: $in
 *                     description: Filter by matching value.
 *                   - type: array
 *                     description: Filter by values in this array.
 *                     items:
 *                       type: string
 *                       title: $in
 *                       description: Filter matching values.
 *             $nin:
 *               type: array
 *               description: Filter by values not in this array.
 *               items:
 *                 oneOf:
 *                   - type: string
 *                     title: $nin
 *                     description: Filter by values not matching this parameter.
 *                   - type: array
 *                     description: Filter by values not in this array.
 *                     items:
 *                       type: string
 *                       title: $nin
 *                       description: Filter by values not matching this parameter.
 *             $not:
 *               oneOf:
 *                 - type: string
 *                   title: $not
 *                   description: Filter by values not matching this parameter.
 *                 - type: object
 *                   description: Filter by values not matching the conditions in this parameter.
 *                   properties:
 *                     $and:
 *                       type: array
 *                       description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                       items:
 *                         type: object
 *                       title: $and
 *                     $or:
 *                       type: array
 *                       description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                       items:
 *                         type: object
 *                       title: $or
 *                     $eq:
 *                       oneOf:
 *                         - type: string
 *                           title: $eq
 *                           description: Filter by an exact match.
 *                         - type: array
 *                           description: Filter by exact matches.
 *                           items:
 *                             type: string
 *                             title: $eq
 *                             description: Filter by an exact match.
 *                     $ne:
 *                       type: string
 *                       title: $ne
 *                       description: Filter by values not equal to this parameter.
 *                     $in:
 *                       type: array
 *                       description: Filter by values in this array.
 *                       items:
 *                         type: string
 *                         title: $in
 *                         description: Filter by values in this array.
 *                     $nin:
 *                       type: array
 *                       description: Filter by values not in this array.
 *                       items:
 *                         type: string
 *                         title: $nin
 *                         description: Filter by values not in this array.
 *                     $not:
 *                       oneOf:
 *                         - type: string
 *                           title: $not
 *                           description: Filter by values not matching this parameter.
 *                         - type: object
 *                           description: Filter by values not matching the conditions in this parameter.
 *                         - type: array
 *                           description: Filter by values not in this array.
 *                           items:
 *                             type: string
 *                             title: $not
 *                             description: Filter by values not matching this parameter.
 *                     $gt:
 *                       type: string
 *                       title: $gt
 *                       description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                     $gte:
 *                       type: string
 *                       title: $gte
 *                       description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                     $lt:
 *                       type: string
 *                       title: $lt
 *                       description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                     $lte:
 *                       type: string
 *                       title: $lte
 *                       description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                     $like:
 *                       type: string
 *                       title: $like
 *                       description: Apply a `like` filter. Useful for strings only.
 *                     $re:
 *                       type: string
 *                       title: $re
 *                       description: Apply a regex filter. Useful for strings only.
 *                     $ilike:
 *                       type: string
 *                       title: $ilike
 *                       description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                     $fulltext:
 *                       type: string
 *                       title: $fulltext
 *                       description: Filter to apply on full-text properties.
 *                     $overlap:
 *                       type: array
 *                       description: Filter arrays that have overlapping values with this parameter.
 *                       items:
 *                         type: string
 *                         title: $overlap
 *                         description: Filter arrays that have overlapping values with this parameter.
 *                     $contains:
 *                       type: array
 *                       description: Filter arrays that contain some of the values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $contains
 *                         description: Filter arrays that contain some of the values of this parameter.
 *                     $contained:
 *                       type: array
 *                       description: Filter arrays that contain all values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $contained
 *                         description: Filter arrays that contain all values of this parameter.
 *                     $exists:
 *                       type: boolean
 *                       title: $exists
 *                       description: Filter by whether a value for this parameter exists (not `null`).
 *                 - type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $not
 *                     description: Filter by values not matching this parameter.
 *                 - type: array
 *                   description: Filter by values not matching the conditions in this parameter.
 *                   items:
 *                     oneOf:
 *                       - type: string
 *                         title: $not
 *                         description: Filter by values not matching this parameter.
 *                       - type: object
 *                         description: Filter by values not matching the conditions in this parameter.
 *                         properties:
 *                           $and:
 *                             type: array
 *                             description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                             items:
 *                               type: object
 *                             title: $and
 *                           $or:
 *                             type: array
 *                             description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                             items:
 *                               type: object
 *                             title: $or
 *                           $eq:
 *                             oneOf:
 *                               - type: string
 *                                 title: $eq
 *                                 description: Filter by an exact match.
 *                               - type: array
 *                                 description: Filter by exact matches.
 *                                 items:
 *                                   type: string
 *                                   title: $eq
 *                                   description: Filter by an exact match.
 *                           $ne:
 *                             type: string
 *                             title: $ne
 *                             description: Filter by values not equal to this parameter.
 *                           $in:
 *                             type: array
 *                             description: Filter by values in this array.
 *                             items:
 *                               type: string
 *                               title: $in
 *                               description: Filter by exact matches.
 *                           $nin:
 *                             type: array
 *                             description: Filter by values not in this array.
 *                             items:
 *                               type: string
 *                               title: $nin
 *                               description: Filter by values not matching this parameter.
 *                           $not:
 *                             oneOf:
 *                               - type: string
 *                                 title: $not
 *                                 description: Filter by values not matching this parameter.
 *                               - type: object
 *                                 description: Filter by values not matching the conditions in this parameter.
 *                               - type: array
 *                                 description: Filter by values not in this array.
 *                                 items:
 *                                   type: string
 *                                   title: $not
 *                                   description: Filter by values not matching this parameter.
 *                           $gt:
 *                             type: string
 *                             title: $gt
 *                             description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                           $gte:
 *                             type: string
 *                             title: $gte
 *                             description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                           $lt:
 *                             type: string
 *                             title: $lt
 *                             description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                           $lte:
 *                             type: string
 *                             title: $lte
 *                             description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                           $like:
 *                             type: string
 *                             title: $like
 *                             description: Apply a `like` filter. Useful for strings only.
 *                           $re:
 *                             type: string
 *                             title: $re
 *                             description: Apply a regex filter. Useful for strings only.
 *                           $ilike:
 *                             type: string
 *                             title: $ilike
 *                             description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                           $fulltext:
 *                             type: string
 *                             title: $fulltext
 *                             description: Filter to apply on full-text properties.
 *                           $overlap:
 *                             type: array
 *                             description: Filter arrays that have overlapping values with this parameter.
 *                             items:
 *                               type: string
 *                               title: $overlap
 *                               description: Filter arrays that have overlapping values with this parameter.
 *                           $contains:
 *                             type: array
 *                             description: Filter arrays that contain some of the values of this parameter.
 *                             items:
 *                               type: string
 *                               title: $contains
 *                               description: Filter arrays that contain some of the values of this parameter.
 *                           $contained:
 *                             type: array
 *                             description: Filter arrays that contain all values of this parameter.
 *                             items:
 *                               type: string
 *                               title: $contained
 *                               description: Filter arrays that contain all values of this parameter.
 *                           $exists:
 *                             type: boolean
 *                             title: $exists
 *                             description: Filter by whether a value for this parameter exists (not `null`).
 *             $gt:
 *               oneOf:
 *                 - type: string
 *                   title: $gt
 *                   description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values greater than items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $gt
 *                     description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *             $gte:
 *               oneOf:
 *                 - type: string
 *                   title: $gte
 *                   description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values greater than or equal to items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $gte
 *                     description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *             $lt:
 *               oneOf:
 *                 - type: string
 *                   title: $lt
 *                   description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values less than items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $lt
 *                     description: Filter by values less than this parameter. Useful for numbers and dates only.
 *             $lte:
 *               oneOf:
 *                 - type: string
 *                   title: $lte
 *                   description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values less than or equal to items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $lte
 *                     description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *             $like:
 *               type: string
 *               title: $like
 *               description: Apply a `like` filter. Useful for strings only.
 *             $re:
 *               type: string
 *               title: $re
 *               description: Apply a regex filter. Useful for strings only.
 *             $ilike:
 *               type: string
 *               title: $ilike
 *               description: Apply a case-insensitive `like` filter. Useful for strings only.
 *             $fulltext:
 *               type: string
 *               title: $fulltext
 *               description: Filter to apply on full-text properties.
 *             $overlap:
 *               type: array
 *               description: Filter arrays that have overlapping values with this parameter.
 *               items:
 *                 type: string
 *                 title: $overlap
 *                 description: Filter arrays that have overlapping values with this parameter.
 *             $contains:
 *               type: array
 *               description: Filter arrays that contain some of the values of this parameter.
 *               items:
 *                 type: string
 *                 title: $contains
 *                 description: Filter arrays that contain some of the values of this parameter.
 *             $contained:
 *               type: array
 *               description: Filter arrays that contain all values of this parameter.
 *               items:
 *                 type: string
 *                 title: $contained
 *                 description: Filter arrays that contain all values of this parameter.
 *             $exists:
 *               type: boolean
 *               title: $exists
 *               description: Filter by whether a value for this parameter exists (not `null`).
 *   - name: status
 *     in: query
 *     required: false
 *     schema:
 *       oneOf:
 *         - type: string
 *           title: status
 *           description: Filter by a draft order's status.
 *         - type: array
 *           description: Filter by draft order statuses.
 *           items:
 *             type: string
 *             title: status
 *             description: The draft order status.
 *         - type: object
 *           description: Filter by conditions on the status.
 *           properties:
 *             $and:
 *               type: array
 *               description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *               items:
 *                 type: object
 *               title: $and
 *             $or:
 *               type: array
 *               description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *               items:
 *                 type: object
 *               title: $or
 *             $eq:
 *               oneOf:
 *                 - type: string
 *                   title: $eq
 *                   description: Filter by an exact match.
 *                 - type: array
 *                   description: Filter by exact matches.
 *                   items:
 *                     type: string
 *                     title: $eq
 *                     description: Filter by an exact match.
 *                 - type: array
 *                   description: Filter by exact matches.
 *                   items:
 *                     oneOf:
 *                       - type: string
 *                         title: $eq
 *                         description: Filter by an exact match.
 *                       - type: array
 *                         description: Filter by exact matches.
 *                         items:
 *                           type: string
 *                           title: $eq
 *                           description: Filter by an exact match.
 *             $ne:
 *               oneOf:
 *                 - type: string
 *                   title: $ne
 *                   description: Filter by values not equal to this parameter.
 *                 - type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $ne
 *                     description: Filter by values not equal to this parameter.
 *             $in:
 *               type: array
 *               description: Filter by values in this array.
 *               items:
 *                 oneOf:
 *                   - type: string
 *                     title: $in
 *                     description: Filter by matching value.
 *                   - type: array
 *                     description: Filter by values in this array.
 *                     items:
 *                       type: string
 *                       title: $in
 *                       description: Filter matching values.
 *             $nin:
 *               type: array
 *               description: Filter by values not in this array.
 *               items:
 *                 oneOf:
 *                   - type: string
 *                     title: $nin
 *                     description: Filter by values not matching this parameter.
 *                   - type: array
 *                     description: Filter by values not in this array.
 *                     items:
 *                       type: string
 *                       title: $nin
 *                       description: Filter by values not matching this parameter.
 *             $not:
 *               oneOf:
 *                 - type: string
 *                   title: $not
 *                   description: Filter by values not matching this parameter.
 *                 - type: object
 *                   description: Filter by values not matching the conditions in this parameter.
 *                   properties:
 *                     $and:
 *                       type: array
 *                       description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                       items:
 *                         type: object
 *                       title: $and
 *                     $or:
 *                       type: array
 *                       description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                       items:
 *                         type: object
 *                       title: $or
 *                     $eq:
 *                       oneOf:
 *                         - type: string
 *                           title: $eq
 *                           description: Filter by an exact match.
 *                         - type: array
 *                           description: Filter by exact matches.
 *                           items:
 *                             type: string
 *                             title: $eq
 *                             description: Filter by an exact match.
 *                     $ne:
 *                       type: string
 *                       title: $ne
 *                       description: Filter by values not equal to this parameter.
 *                     $in:
 *                       type: array
 *                       description: Filter by values in this array.
 *                       items:
 *                         type: string
 *                         title: $in
 *                         description: Filter by values in this array.
 *                     $nin:
 *                       type: array
 *                       description: Filter by values not in this array.
 *                       items:
 *                         type: string
 *                         title: $nin
 *                         description: Filter by values not in this array.
 *                     $not:
 *                       oneOf:
 *                         - type: string
 *                           title: $not
 *                           description: Filter by values not matching this parameter.
 *                         - type: object
 *                           description: Filter by values not matching the conditions in this parameter.
 *                         - type: array
 *                           description: Filter by values not in this array.
 *                           items:
 *                             type: string
 *                             title: $not
 *                             description: Filter by values not matching this parameter.
 *                     $gt:
 *                       type: string
 *                       title: $gt
 *                       description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                     $gte:
 *                       type: string
 *                       title: $gte
 *                       description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                     $lt:
 *                       type: string
 *                       title: $lt
 *                       description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                     $lte:
 *                       type: string
 *                       title: $lte
 *                       description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                     $like:
 *                       type: string
 *                       title: $like
 *                       description: Apply a `like` filter. Useful for strings only.
 *                     $re:
 *                       type: string
 *                       title: $re
 *                       description: Apply a regex filter. Useful for strings only.
 *                     $ilike:
 *                       type: string
 *                       title: $ilike
 *                       description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                     $fulltext:
 *                       type: string
 *                       title: $fulltext
 *                       description: Filter to apply on full-text properties.
 *                     $overlap:
 *                       type: array
 *                       description: Filter arrays that have overlapping values with this parameter.
 *                       items:
 *                         type: string
 *                         title: $overlap
 *                         description: Filter arrays that have overlapping values with this parameter.
 *                     $contains:
 *                       type: array
 *                       description: Filter arrays that contain some of the values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $contains
 *                         description: Filter arrays that contain some of the values of this parameter.
 *                     $contained:
 *                       type: array
 *                       description: Filter arrays that contain all values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $contained
 *                         description: Filter arrays that contain all values of this parameter.
 *                     $exists:
 *                       type: boolean
 *                       title: $exists
 *                       description: Filter by whether a value for this parameter exists (not `null`).
 *                 - type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $not
 *                     description: Filter by values not matching this parameter.
 *                 - type: array
 *                   description: Filter by values not matching the conditions in this parameter.
 *                   items:
 *                     oneOf:
 *                       - type: string
 *                         title: $not
 *                         description: Filter by values not matching this parameter.
 *                       - type: object
 *                         description: Filter by values not matching the conditions in this parameter.
 *                         properties:
 *                           $and:
 *                             type: array
 *                             description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                             items:
 *                               type: object
 *                             title: $and
 *                           $or:
 *                             type: array
 *                             description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                             items:
 *                               type: object
 *                             title: $or
 *                           $eq:
 *                             oneOf:
 *                               - type: string
 *                                 title: $eq
 *                                 description: Filter by an exact match.
 *                               - type: array
 *                                 description: Filter by exact matches.
 *                                 items:
 *                                   type: string
 *                                   title: $eq
 *                                   description: Filter by an exact match.
 *                           $ne:
 *                             type: string
 *                             title: $ne
 *                             description: Filter by values not equal to this parameter.
 *                           $in:
 *                             type: array
 *                             description: Filter by values in this array.
 *                             items:
 *                               type: string
 *                               title: $in
 *                               description: Filter by exact matches.
 *                           $nin:
 *                             type: array
 *                             description: Filter by values not in this array.
 *                             items:
 *                               type: string
 *                               title: $nin
 *                               description: Filter by values not matching this parameter.
 *                           $not:
 *                             oneOf:
 *                               - type: string
 *                                 title: $not
 *                                 description: Filter by values not matching this parameter.
 *                               - type: object
 *                                 description: Filter by values not matching the conditions in this parameter.
 *                               - type: array
 *                                 description: Filter by values not in this array.
 *                                 items:
 *                                   type: string
 *                                   title: $not
 *                                   description: Filter by values not matching this parameter.
 *                           $gt:
 *                             type: string
 *                             title: $gt
 *                             description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                           $gte:
 *                             type: string
 *                             title: $gte
 *                             description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                           $lt:
 *                             type: string
 *                             title: $lt
 *                             description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                           $lte:
 *                             type: string
 *                             title: $lte
 *                             description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                           $like:
 *                             type: string
 *                             title: $like
 *                             description: Apply a `like` filter. Useful for strings only.
 *                           $re:
 *                             type: string
 *                             title: $re
 *                             description: Apply a regex filter. Useful for strings only.
 *                           $ilike:
 *                             type: string
 *                             title: $ilike
 *                             description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                           $fulltext:
 *                             type: string
 *                             title: $fulltext
 *                             description: Filter to apply on full-text properties.
 *                           $overlap:
 *                             type: array
 *                             description: Filter arrays that have overlapping values with this parameter.
 *                             items:
 *                               type: string
 *                               title: $overlap
 *                               description: Filter arrays that have overlapping values with this parameter.
 *                           $contains:
 *                             type: array
 *                             description: Filter arrays that contain some of the values of this parameter.
 *                             items:
 *                               type: string
 *                               title: $contains
 *                               description: Filter arrays that contain some of the values of this parameter.
 *                           $contained:
 *                             type: array
 *                             description: Filter arrays that contain all values of this parameter.
 *                             items:
 *                               type: string
 *                               title: $contained
 *                               description: Filter arrays that contain all values of this parameter.
 *                           $exists:
 *                             type: boolean
 *                             title: $exists
 *                             description: Filter by whether a value for this parameter exists (not `null`).
 *             $gt:
 *               oneOf:
 *                 - type: string
 *                   title: $gt
 *                   description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values greater than items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $gt
 *                     description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *             $gte:
 *               oneOf:
 *                 - type: string
 *                   title: $gte
 *                   description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values greater than or equal to items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $gte
 *                     description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *             $lt:
 *               oneOf:
 *                 - type: string
 *                   title: $lt
 *                   description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values less than items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $lt
 *                     description: Filter by values less than this parameter. Useful for numbers and dates only.
 *             $lte:
 *               oneOf:
 *                 - type: string
 *                   title: $lte
 *                   description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                 - type: array
 *                   description: Filter by values less than or equal to items in this array. Useful for numbers and dates only.
 *                   items:
 *                     type: string
 *                     title: $lte
 *                     description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *             $like:
 *               type: string
 *               title: $like
 *               description: Apply a `like` filter. Useful for strings only.
 *             $re:
 *               type: string
 *               title: $re
 *               description: Apply a regex filter. Useful for strings only.
 *             $ilike:
 *               type: string
 *               title: $ilike
 *               description: Apply a case-insensitive `like` filter. Useful for strings only.
 *             $fulltext:
 *               type: string
 *               title: $fulltext
 *               description: Filter to apply on full-text properties.
 *             $overlap:
 *               type: array
 *               description: Filter arrays that have overlapping values with this parameter.
 *               items:
 *                 type: string
 *                 title: $overlap
 *                 description: Filter arrays that have overlapping values with this parameter.
 *             $contains:
 *               type: array
 *               description: Filter arrays that contain some of the values of this parameter.
 *               items:
 *                 type: string
 *                 title: $contains
 *                 description: Filter arrays that contain some of the values of this parameter.
 *             $contained:
 *               type: array
 *               description: Filter arrays that contain all values of this parameter.
 *               items:
 *                 type: string
 *                 title: $contained
 *                 description: Filter arrays that contain all values of this parameter.
 *             $exists:
 *               type: boolean
 *               title: $exists
 *               description: Filter by whether a value for this parameter exists (not `null`).
 *   - name: $and
 *     in: query
 *     description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *     required: false
 *     schema:
 *       type: array
 *       description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *       items:
 *         type: object
 *       title: $and
 *   - name: $or
 *     in: query
 *     description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *     required: false
 *     schema:
 *       type: array
 *       description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *       items:
 *         type: object
 *       title: $or
 *   - name: sales_channel_id
 *     in: query
 *     description: Filter by the associated sales channels to retrieve its draft orders.
 *     required: false
 *     schema:
 *       type: array
 *       description: Filter by the associated sales channels to retrieve its draft orders.
 *       items:
 *         type: string
 *         title: sales_channel_id
 *         description: A sales channel's ID.
 *   - name: region_id
 *     in: query
 *     description: Filter by region IDs to retrieve their associated draft orders.
 *     required: false
 *     schema:
 *       oneOf:
 *         - type: string
 *           title: region_id
 *           description: The draft order's region id.
 *         - type: array
 *           description: The draft order's region id.
 *           items:
 *             type: string
 *             title: region_id
 *             description: The region id's details.
 *   - name: q
 *     in: query
 *     description: Search term to filter the order's searchable properties.
 *     required: false
 *     schema:
 *       type: string
 *       title: q
 *       description: Search term to filter the order's searchable properties.
 *   - name: created_at
 *     in: query
 *     description: Filter by the draft order's creation date.
 *     required: false
 *     schema:
 *       type: object
 *       description: Filter by the draft order's creation date.
 *       properties:
 *         $and:
 *           type: array
 *           description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *           items:
 *             type: object
 *           title: $and
 *         $or:
 *           type: array
 *           description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *           items:
 *             type: object
 *           title: $or
 *         $eq:
 *           oneOf:
 *             - type: string
 *               title: $eq
 *               description: Filter by an exact match.
 *             - type: array
 *               description: Filter by multiple exact matches.
 *               items:
 *                 type: string
 *                 title: $eq
 *                 description: An exact match.
 *         $ne:
 *           type: string
 *           title: $ne
 *           description: Filter by values not equal to this parameter.
 *         $in:
 *           type: array
 *           description: Filter by values in this array.
 *           items:
 *             type: string
 *             title: $in
 *             description: The value to match.
 *         $nin:
 *           type: array
 *           description: Filter by values not in this array.
 *           items:
 *             type: string
 *             title: $nin
 *             description: The value not to match.
 *         $not:
 *           oneOf:
 *             - type: string
 *               title: $not
 *               description: Filter by values not matching this parameter.
 *             - type: object
 *               description: Filter by values not matching the conditions in this parameter.
 *               properties:
 *                 $and:
 *                   type: array
 *                   description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                   items:
 *                     type: object
 *                   title: $and
 *                 $or:
 *                   type: array
 *                   description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                   items:
 *                     type: object
 *                   title: $or
 *                 $eq:
 *                   oneOf:
 *                     - type: string
 *                       title: $eq
 *                       description: Filter by an exact match.
 *                     - type: array
 *                       description: Filter by multiple exact matches.
 *                       items:
 *                         type: string
 *                         title: $eq
 *                         description: The value to match.
 *                 $ne:
 *                   type: string
 *                   title: $ne
 *                   description: Filter by values not matching this parameter.
 *                 $in:
 *                   type: array
 *                   description: Filter by values in this array.
 *                   items:
 *                     type: string
 *                     title: $in
 *                     description: The value to match.
 *                 $nin:
 *                   type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $nin
 *                     description: The value to not match
 *                 $not:
 *                   oneOf:
 *                     - type: string
 *                       title: $not
 *                       description: Filter by values not matching this parameter
 *                     - type: object
 *                       description: Filter by values not matching the conditions in this parameter.
 *                     - type: array
 *                       description: Filter by values not matching the values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $not
 *                         description: The values to not match.
 *                 $gt:
 *                   type: string
 *                   title: $gt
 *                   description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                 $gte:
 *                   type: string
 *                   title: $gte
 *                   description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                 $lt:
 *                   type: string
 *                   title: $lt
 *                   description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                 $lte:
 *                   type: string
 *                   title: $lte
 *                   description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                 $like:
 *                   type: string
 *                   title: $like
 *                   description: Apply a `like` filter. Useful for strings only.
 *                 $re:
 *                   type: string
 *                   title: $re
 *                   description: Apply a regex filter. Useful for strings only.
 *                 $ilike:
 *                   type: string
 *                   title: $ilike
 *                   description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                 $fulltext:
 *                   type: string
 *                   title: $fulltext
 *                   description: Filter to apply on full-text properties.
 *                 $overlap:
 *                   type: array
 *                   description: Filter arrays that have overlapping values with this parameter.
 *                   items:
 *                     type: string
 *                     title: $overlap
 *                     description: The value to match.
 *                 $contains:
 *                   type: array
 *                   description: Filter arrays that contain some of the values of this parameter.
 *                   items:
 *                     type: string
 *                     title: $contains
 *                     description: The values to match.
 *                 $contained:
 *                   type: array
 *                   description: Filter arrays that contain all values of this parameter.
 *                   items:
 *                     type: string
 *                     title: $contained
 *                     description: The values to match.
 *                 $exists:
 *                   type: boolean
 *                   title: $exists
 *                   description: Filter by whether a value for this parameter exists (not `null`).
 *             - type: array
 *               description: Filter by values not matching those in this parameter.
 *               items:
 *                 type: string
 *                 title: $not
 *                 description: The values to not match.
 *         $gt:
 *           type: string
 *           title: $gt
 *           description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *         $gte:
 *           type: string
 *           title: $gte
 *           description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *         $lt:
 *           type: string
 *           title: $lt
 *           description: Filter by values less than this parameter. Useful for numbers and dates only.
 *         $lte:
 *           type: string
 *           title: $lte
 *           description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *         $like:
 *           type: string
 *           title: $like
 *           description: Apply a `like` filter. Useful for strings only.
 *         $re:
 *           type: string
 *           title: $re
 *           description: Apply a regex filter. Useful for strings only.
 *         $ilike:
 *           type: string
 *           title: $ilike
 *           description: Apply a case-insensitive `like` filter. Useful for strings only.
 *         $fulltext:
 *           type: string
 *           title: $fulltext
 *           description: Filter to apply on full-text properties.
 *         $overlap:
 *           type: array
 *           description: Filter arrays that have overlapping values with this parameter.
 *           items:
 *             type: string
 *             title: $overlap
 *             description: The values to match.
 *         $contains:
 *           type: array
 *           description: Filter arrays that contain some of the values of this parameter.
 *           items:
 *             type: string
 *             title: $contains
 *             description: The values to match.
 *         $contained:
 *           type: array
 *           description: Filter arrays that contain all values of this parameter.
 *           items:
 *             type: string
 *             title: $contained
 *             description: The values to match.
 *         $exists:
 *           type: boolean
 *           title: $exists
 *           description: Filter by whether a value for this parameter exists (not `null`).
 *   - name: updated_at
 *     in: query
 *     description: Filter by the draft order's update date.
 *     required: false
 *     schema:
 *       type: object
 *       description: Filter by the draft order's update date.
 *       properties:
 *         $and:
 *           type: array
 *           description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *           items:
 *             type: object
 *           title: $and
 *         $or:
 *           type: array
 *           description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *           items:
 *             type: object
 *           title: $or
 *         $eq:
 *           oneOf:
 *             - type: string
 *               title: $eq
 *               description: Filter by an exact match.
 *             - type: array
 *               description: Filter by multiple exact matches.
 *               items:
 *                 type: string
 *                 title: $eq
 *                 description: An exact match.
 *         $ne:
 *           type: string
 *           title: $ne
 *           description: Filter by values not equal to this parameter.
 *         $in:
 *           type: array
 *           description: Filter by values in this array.
 *           items:
 *             type: string
 *             title: $in
 *             description: The value to match.
 *         $nin:
 *           type: array
 *           description: Filter by values not in this array.
 *           items:
 *             type: string
 *             title: $nin
 *             description: The value not to match.
 *         $not:
 *           oneOf:
 *             - type: string
 *               title: $not
 *               description: Filter by values not matching this parameter.
 *             - type: object
 *               description: Filter by values not matching the conditions in this parameter.
 *               properties:
 *                 $and:
 *                   type: array
 *                   description: Join query parameters with an AND condition. Each object's content is the same type as the expected query parameters.
 *                   items:
 *                     type: object
 *                   title: $and
 *                 $or:
 *                   type: array
 *                   description: Join query parameters with an OR condition. Each object's content is the same type as the expected query parameters.
 *                   items:
 *                     type: object
 *                   title: $or
 *                 $eq:
 *                   oneOf:
 *                     - type: string
 *                       title: $eq
 *                       description: Filter by an exact match.
 *                     - type: array
 *                       description: Filter by multiple exact matches.
 *                       items:
 *                         type: string
 *                         title: $eq
 *                         description: The value to match.
 *                 $ne:
 *                   type: string
 *                   title: $ne
 *                   description: Filter by values not matching this parameter.
 *                 $in:
 *                   type: array
 *                   description: Filter by values in this array.
 *                   items:
 *                     type: string
 *                     title: $in
 *                     description: The value to match.
 *                 $nin:
 *                   type: array
 *                   description: Filter by values not in this array.
 *                   items:
 *                     type: string
 *                     title: $nin
 *                     description: The value to not match
 *                 $not:
 *                   oneOf:
 *                     - type: string
 *                       title: $not
 *                       description: Filter by values not matching this parameter
 *                     - type: object
 *                       description: Filter by values not matching the conditions in this parameter.
 *                     - type: array
 *                       description: Filter by values not matching the values of this parameter.
 *                       items:
 *                         type: string
 *                         title: $not
 *                         description: The values to not match.
 *                 $gt:
 *                   type: string
 *                   title: $gt
 *                   description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *                 $gte:
 *                   type: string
 *                   title: $gte
 *                   description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *                 $lt:
 *                   type: string
 *                   title: $lt
 *                   description: Filter by values less than this parameter. Useful for numbers and dates only.
 *                 $lte:
 *                   type: string
 *                   title: $lte
 *                   description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *                 $like:
 *                   type: string
 *                   title: $like
 *                   description: Apply a `like` filter. Useful for strings only.
 *                 $re:
 *                   type: string
 *                   title: $re
 *                   description: Apply a regex filter. Useful for strings only.
 *                 $ilike:
 *                   type: string
 *                   title: $ilike
 *                   description: Apply a case-insensitive `like` filter. Useful for strings only.
 *                 $fulltext:
 *                   type: string
 *                   title: $fulltext
 *                   description: Filter to apply on full-text properties.
 *                 $overlap:
 *                   type: array
 *                   description: Filter arrays that have overlapping values with this parameter.
 *                   items:
 *                     type: string
 *                     title: $overlap
 *                     description: The value to match.
 *                 $contains:
 *                   type: array
 *                   description: Filter arrays that contain some of the values of this parameter.
 *                   items:
 *                     type: string
 *                     title: $contains
 *                     description: The values to match.
 *                 $contained:
 *                   type: array
 *                   description: Filter arrays that contain all values of this parameter.
 *                   items:
 *                     type: string
 *                     title: $contained
 *                     description: The values to match.
 *                 $exists:
 *                   type: boolean
 *                   title: $exists
 *                   description: Filter by whether a value for this parameter exists (not `null`).
 *             - type: array
 *               description: Filter by values not matching those in this parameter.
 *               items:
 *                 type: string
 *                 title: $not
 *                 description: The values to not match.
 *         $gt:
 *           type: string
 *           title: $gt
 *           description: Filter by values greater than this parameter. Useful for numbers and dates only.
 *         $gte:
 *           type: string
 *           title: $gte
 *           description: Filter by values greater than or equal to this parameter. Useful for numbers and dates only.
 *         $lt:
 *           type: string
 *           title: $lt
 *           description: Filter by values less than this parameter. Useful for numbers and dates only.
 *         $lte:
 *           type: string
 *           title: $lte
 *           description: Filter by values less than or equal to this parameter. Useful for numbers and dates only.
 *         $like:
 *           type: string
 *           title: $like
 *           description: Apply a `like` filter. Useful for strings only.
 *         $re:
 *           type: string
 *           title: $re
 *           description: Apply a regex filter. Useful for strings only.
 *         $ilike:
 *           type: string
 *           title: $ilike
 *           description: Apply a case-insensitive `like` filter. Useful for strings only.
 *         $fulltext:
 *           type: string
 *           title: $fulltext
 *           description: Filter to apply on full-text properties.
 *         $overlap:
 *           type: array
 *           description: Filter arrays that have overlapping values with this parameter.
 *           items:
 *             type: string
 *             title: $overlap
 *             description: The values to match.
 *         $contains:
 *           type: array
 *           description: Filter arrays that contain some of the values of this parameter.
 *           items:
 *             type: string
 *             title: $contains
 *             description: The values to match.
 *         $contained:
 *           type: array
 *           description: Filter arrays that contain all values of this parameter.
 *           items:
 *             type: string
 *             title: $contained
 *             description: The values to match.
 *         $exists:
 *           type: boolean
 *           title: $exists
 *           description: Filter by whether a value for this parameter exists (not `null`).
 *   - name: customer_id
 *     in: query
 *     required: false
 *     schema:
 *       oneOf:
 *         - type: string
 *           title: customer_id
 *           description: The draft order's customer id.
 *         - type: array
 *           description: The draft order's customer id.
 *           items:
 *             type: string
 *             title: customer_id
 *             description: The customer id's details.
 *   - name: with_deleted
 *     in: query
 *     description: Whether to include deleted records in the result.
 *     required: false
 *     schema:
 *       type: boolean
 *       title: with_deleted
 *       description: Whether to include deleted records in the result.
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS SDK
 *     source: |-
 *       import Medusa from "@medusajs/js-sdk"
 * 
 *       export const sdk = new Medusa({
 *         baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
 *         debug: import.meta.env.DEV,
 *         auth: {
 *           type: "session",
 *         },
 *       })
 * 
 *       sdk.admin.draftOrder.list()
 *       .then(({ draft_orders, count, limit, offset }) => {
 *         console.log(draft_orders)
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: |-
 *       curl '{backend_url}/admin/draft-orders' \
 *       -H 'Authorization: Bearer {access_token}'
 * tags:
 *   - Draft Orders
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminDraftOrderListResponse"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 * x-workflow: getOrdersListWorkflow
 * x-events: []
 * 
*/

