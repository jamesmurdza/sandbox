import type { z } from "zod";

import { resolver } from "hono-openapi/zod";

// eslint-disable-next-line ts/ban-ts-comment
// @ts-expect-error
export type ZodSchema = z.ZodUnion | z.AnyZodObject | z.ZodArray<z.AnyZodObject>;
function jsonContent<
    T extends ZodSchema,
>(schema: T, description: string) {
    return {
        content: {
            "application/json": {
                schema: resolver(schema),
            },
        },
        description,
    };
}

export default jsonContent;