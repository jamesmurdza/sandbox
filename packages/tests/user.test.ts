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

let testUser: {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string
}

const newTestUser = {
  id: "test-user-id-post",
  name: "Test User",
  email: "testuser@example.com",
  username: "testuser_post",
  avatarUrl: "https://example.com/avatar.png",
}

// #region /api/user
describe("GET /api/user", () => {
  describe("With Id", () => {
    let response: AxiosResponse<any, any>
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await apiClient.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
      body = response.data
      testUser = body.data as any
    })

    test("Should have response status 200", () => {
      expect(response.status).toBe(200)
    })
    test("Should have object in the body", () => {
      expectTypeOf(body).toBeObject()
    })
    test("Should have userId in the body", () => {})
    test("Should return user data", () => {
      expect(body).toHaveProperty("data")
      expect(body.data).toHaveProperty("id")
      expect((body.data as any).id).toBe(env.CLERK_TEST_USER_ID)
    })
  })
  describe("With wrong Id", () => {
    let response: AxiosResponse<any, any>
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await apiClient.get("/user?id=wrong-id")
      body = response.data
    })
    test("Should have response status 404", () => {
      expect(response.status).toBe(404)
    })
    test("Should return error", () => {
      expect(body).toHaveProperty("success")
      expect(body.success).toEqual(false)
    })
  })
  describe("With username", () => {
    let response: AxiosResponse<any, any>
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await apiClient.get(`/user?username=${testUser?.username}`)
      body = response.data
    })

    test("Should have response status 200", () => {
      expect(response.status).toBe(200)
    })

    test("Should have user data", () => {
      expect(body).toHaveProperty("data")
      expect(body.data).toHaveProperty("id")
      expect((body.data as any).id).toBe(env.CLERK_TEST_USER_ID)
    })
  })
  describe("With wrong username", () => {
    let response: AxiosResponse<any, any>
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await apiClient.get(`/user?username=wrong-username`)
      body = response.data
    })

    test("Should have response status 404", () => {
      expect(response.status).toBe(404)
    })
    test("Should return error", () => {
      expect(body).toHaveProperty("success")
      expect(body.success).toEqual(false)
    })
  })
})
describe("POST /api/user", () => {
  test("Should create a new user", async () => {
    const response = await apiClient.post("/user", { ...newTestUser })
    const body = response.data

    console.log("POST user: ", JSON.stringify(body, null, 2))
    expect(response.status).toBe(200)
    expect(body.res).toMatchObject({
      id: newTestUser.id,
      name: newTestUser.name,
      email: newTestUser.email,
      username: newTestUser.username,
    })
  })
})

describe("PATCH /api/user", () => {
  const userId = env.CLERK_TEST_USER_ID
  test("Should update user data", async () => {
    const response = await apiClient.patch("/user", {
      id: userId,
      name: "Updated Test Name",
      bio: "Updated bio",
      personalWebsite: "https://updated.example.com",
    })
    const body = response.data

    expect(response.status).toBe(200)
    expect(body.res).toMatchObject({
      id: userId,
      name: "Updated Test Name",
      bio: "Updated bio",
      personalWebsite: "https://updated.example.com",
    })
  })

  test("Should return conflict if username already exists", async () => {
    const response = await apiClient.patch("/user", {
      id: userId,
      username: newTestUser.username, // This username should already exist from the previous test
    })
    const body = response.data

    expect(response.status).toBe(409)
    expect(body).toHaveProperty("error", "Username already exists")
  })

  afterAll(async () => {
    await apiClient.patch("/user", {
      id: userId,
      name: testUser.name,
      email: testUser.email,
    })
  })
})

describe("DELETE /api/user", () => {
  test("Should delete user", async () => {
    const response = await apiClient.delete(`/user?id=${newTestUser.id}`)
    expect(response.status).toBe(200)

    const confirm = await apiClient.get(`/user?id=${newTestUser.id}`)
    const confirmBody = confirm.data
    expect(confirmBody.success).toEqual(false)
  })

  test("Should return error if ID is missing", async () => {
    const response = await apiClient.delete("/user")

    expect(response.status).toBe(400)
  })
})
// #endregion

// #region /api/user/check-username
describe("GET /api/user/check-username", () => {
  test("Should return true if username exists", async () => {
    const res = await apiClient.get(
      `/user/check-username?username=${testUser.username}`
    )
    const body = res.data

    expect(res.status).toBe(200)
    expect(body.exists).toBe(true)
  })

  test("Should return false if username doesn't exist", async () => {
    const res = await apiClient.get(
      "/user/check-username?username=nonexistent_user"
    )
    const body = res.data

    expect(res.status).toBe(200)
    expect(body.exists).toBe(false)
  })

  test("Should return 400 if username is missing", async () => {
    const res = await apiClient.get("/user/check-username")
    expect(res.status).toBe(400)
  })
})
// #endregion

// #region /api/user/increment-generations
describe("POST /api/user/increment-generations", () => {
  let previousGenerations: number

  beforeAll(async () => {
    const res = await apiClient.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = res.data
    previousGenerations = data.generations ?? 0
  })

  test("Should increment the generations field by 1", async () => {
    const res = await apiClient.post("/user/increment-generations", {
      userId: env.CLERK_TEST_USER_ID,
    })
    expect(res.status).toBe(200)

    const after = await apiClient.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = after.data.data
    expect(data.generations).toBe(previousGenerations + 1)
  })
})
// #endregion

// #region /api/user/update-tier
describe("POST /api/user/update-tier", () => {
  let previousTier: string
  let previousExpires: string

  beforeAll(async () => {
    const res = await apiClient.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = res.data
    previousTier = data.tier
    previousExpires = data.tierExpiresAt
  })

  test("Should update tier and reset generations", async () => {
    const res = await apiClient.post("/user/update-tier", {
      userId: env.CLERK_TEST_USER_ID,
      tier: "PRO",
      tierExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    })

    expect(res.status).toBe(200)

    const after = await apiClient.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = after.data.data
    expect(data.tier).toBe("PRO")
    expect(data.generations).toBe(0)
  })

  afterAll(async () => {
    await apiClient.post("/user/update-tier", {
      userId: env.CLERK_TEST_USER_ID,
      tier: previousTier,
      tierExpiresAt: new Date(previousExpires),
    })
  })
})
// #endregion

// #region /api/user/check-reset
describe("POST /api/user/check-reset", () => {
  test("Should reset generations if month changed", async () => {
    // Force a lastResetDate to a past month
    const upateUserRes = await apiClient.patch("/user", {
      id: env.CLERK_TEST_USER_ID,
      lastResetDate: new Date("2000-01-01"),
    })

    const res = await apiClient.post("/user/check-reset", {
      userId: env.CLERK_TEST_USER_ID,
    })

    const text = res.data.message
    expect(res.status).toBe(200)
    expect(text).toBeOneOf(["Reset successful", "No reset needed"])
  })

  test("Should skip reset if already reset this month", async () => {
    const res = await apiClient.post("/user/check-reset", {
      userId: env.CLERK_TEST_USER_ID,
    })

    const text = res.data.message
    expect(res.status).toBe(400)
    expect(text).toBe("Already reset this month")
  })

  test("Should return 404 if user doesn't exist", async () => {
    const res = await apiClient.post("/user/check-reset", {
      userId: "nonexistent-id",
    })

    expect(res.status).toBe(404)
  })
})
// #endregion
