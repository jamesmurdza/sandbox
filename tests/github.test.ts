import {
    beforeAll,
    describe,
    expect,
    expectTypeOf,
    test
} from "vitest"
import { api } from "./utils/api"
import { env } from "./utils/env"

const BEFORE_ALL_TIMEOUT = 30000 // 30 sec

describe("GET /api/github/authenticate/url", () => {
    let response: Response
    let body: { data: { auth_url: string } }

    beforeAll(async () => {
        response = await api.get("/github/authenticate/url")
        body = await response.json()
    }, BEFORE_ALL_TIMEOUT)

    test("Should have response status 200", () => {
        expect(response.status).toBe(200)
    })

    test("Should have auth_url", async () => {
        expectTypeOf(body).toBeObject()
        expect(body).toHaveProperty("data")
        expect(body.data).toHaveProperty("auth_url")
        expectTypeOf(body.data.auth_url).toBeString()
    })
})

describe("GET /api/github/user", () => {
    let response: Response
    let body: { data: { email: string } }
    beforeAll(async () => {
        // set the PAT to user's object
        await api.put("/user", {
            body: {
                id: env.CLERK_TEST_USER_ID,
                githubToken: env.GITHUB_PAT
            }
        })
        response = await api.get(`/github/user?userId=${env.CLERK_TEST_USER_ID}`, {

        })
        body = await response.json()
    })
    test("Should have response status 200", () => {
        expect(response.status).toBe(200)
    })


    test("Should have user data", async () => {
        expectTypeOf(body).toBeObject()
        expect(body).toHaveProperty("data")
        expect(body.data).toHaveProperty("email")
        expectTypeOf(body.data.email).toBeString()
    })
})


describe("GET /api/github/repo/status", () => {
    test.todo("Implement tests")
})

describe("POST /api/github/repo/create", () => {
    test.todo("Implement tests")
})

describe("POST /api/github/repo/commit", () => {
    test.todo("Implement tests")
})

describe("POST /api/github/repo/remove", () => {
    test.todo("Implement tests")
})


describe("POST /logout", async () => {
    let response: Response
    beforeAll(async () => {
        response = await api.post("/github/logout", {
            body: {
                userId: env.CLERK_TEST_USER_ID
            }
        })
    })

    test("Should have response status 200", () => {
        expect(response.status).toBe(200)
    })

    test("Should return success message", async () => {
        const body = await response.json()
        expect(body.message).toEqual("Logout successful")
    })
    test("Should remove githubToken from user", async () => {
        const userResponse = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
        const userBody = await userResponse.json()
        expect(userBody.githubToken).toBe('')
    })
})