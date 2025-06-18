import { AxiosResponse } from "axios"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  test,
} from "vitest"
import { apiClient } from "./utils/api"
import { env } from "./utils/env"

const BEFORE_ALL_TIMEOUT = 30000 // 30 sec
let userGithubToken: string | null = null
describe("GET /api/github/auth_url", () => {
  let response: AxiosResponse
  let body: { data: { auth_url: string } }

  beforeAll(async () => {
    response = await apiClient.get("/github/auth_url")
    body = response.data
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
  let response: AxiosResponse
  let body: { data: { email: string } }
  beforeAll(async () => {
    // get user data
    const userResponse = await apiClient.get("/user")
    const userData = userResponse.data.data
    userGithubToken = userData.githubToken

    // set the PAT to user's object
    await apiClient.patch("/user", {
      id: env.CLERK_TEST_USER_ID,
      githubToken: env.GITHUB_PAT,
    })
    response = await apiClient.get(
      `/github/user?userId=${env.CLERK_TEST_USER_ID}`,
      {}
    )
    body = response.data
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
  let response: AxiosResponse
  beforeAll(async () => {
    response = await apiClient.post("/github/logout")
  })

  test("Should have response status 200", () => {
    expect(response.status).toBe(200)
  })

  test("Should return success message", async () => {
    const body = response.data
    expect(body.message).toEqual("User logged out successfully")
  })
  test("Should remove githubToken from user", async () => {
    const userResponse = await apiClient.get(`/user`)
    const userBody = userResponse.data.data
    expect(userBody.githubToken).toBe(null)
  })
  afterAll(async () => {
    // Restore the original user token
    if (userGithubToken) {
      await apiClient.patch("/user", {
        id: env.CLERK_TEST_USER_ID,
        githubToken: userGithubToken,
      })
    }
  })
})
