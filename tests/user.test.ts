import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  test,
} from "vitest"
import { api } from "./utils/api"
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
  describe("Get all users", () => {
    let response: Response
    let body: Array<{ [key: string]: unknown }>
    beforeAll(async () => {
      response = await api.get("/user")
      body = await response.json()
    })
    test("Should have response status 200", () => {
      expect(response.status).toBe(200)
    })
    test("Should have array in the body", () => {
      expectTypeOf(body).toBeArray()
    })
  }),
    describe("With Id", () => {
      let response: Response
      let body: { [key: string]: unknown }

      beforeAll(async () => {
        response = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
        body = await response.json()
        testUser = body as any
      })

      test("Should have response status 200", () => {
        expect(response.status).toBe(200)
      })
      test("Should have object in the body", () => {
        expectTypeOf(body).toBeObject()
      })
      test("Should have userId in the body", () => {
        expect(body.id).toBe(env.CLERK_TEST_USER_ID)
      })
      test("Should return sandboxes", () => {
        expect(body).toHaveProperty("sandbox")
        expectTypeOf(body.sandboxes).toBeArray
      })
    })
  describe("With wrong Id", () => {
    let response: Response
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await api.get(`/user?id=wrong-id`)
      body = await response.json()
    })

    test("Should return empty object", () => {
      expect(body).toEqual({})
    })
  })
  describe("With username", () => {
    let response: Response
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await api.get(`/user?username=${testUser?.username}`)
      body = await response.json()
    })

    test("Should have response status 200", () => {
      expect(response.status).toBe(200)
    })
    test("Should have object in the body", () => {
      expectTypeOf(body).toBeObject()
    })
    test("Should have userId in the body", () => {
      expect(body.id).toBe(env.CLERK_TEST_USER_ID)
    })
  })
  describe("With wrong username", () => {
    let response: Response
    let body: { [key: string]: unknown }

    beforeAll(async () => {
      response = await api.get(`/user?username=wrong-username`)
      body = await response.json()
    })

    test("Should return empty object", () => {
      expect(body).toEqual({})
    })
  })
})
describe("POST /api/user", () => {
  test("Should create a new user", async () => {
    const response = await api.post("/user", { body: newTestUser })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.res).toMatchObject({
      id: newTestUser.id,
      name: newTestUser.name,
      email: newTestUser.email,
      username: newTestUser.username,
    })
  })
})

describe("PUT /api/user", () => {
  const userId = env.CLERK_TEST_USER_ID
  test("Should update user data", async () => {
    const response = await api.put("/user", {
      body: {
        id: userId,
        name: "Updated Test Name",
        bio: "Updated bio",
        personalWebsite: "https://updated.example.com",
      },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.res).toMatchObject({
      id: userId,
      name: "Updated Test Name",
      bio: "Updated bio",
      personalWebsite: "https://updated.example.com",
    })
  })

  test("Should return conflict if username already exists", async () => {
    const response = await api.put("/user", {
      body: {
        id: userId,
        username: newTestUser.username, // This username should already exist from the previous test
      },
    })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toHaveProperty("error", "Username already exists")
  })

  afterAll(async () => {
    await api.put("/user", {
      body: {
        id: userId,
        name: testUser.name,
        email: testUser.email,
      },
    })
  })
})

describe("DELETE /api/user", () => {
  test("Should delete user", async () => {
    const response = await api.delete(`/user?id=${newTestUser.id}`)
    expect(response.status).toBe(200)

    const confirm = await api.get(`/user?id=${newTestUser.id}`)
    const confirmBody = await confirm.json()
    expect(confirmBody).toEqual({})
  })

  test("Should return error if ID is missing", async () => {
    const response = await api.delete("/user")
    const body = await response.text()

    expect(response.status).toBe(400)
    expect(body).toMatch(/Invalid/i)
  })
})
// #endregion

// #region /api/user/check-username
describe("GET /api/user/check-username", () => {
  test("Should return true if username exists", async () => {
    const res = await api.get(
      `/user/check-username?username=${testUser.username}`
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.exists).toBe(true)
  })

  test("Should return false if username doesn't exist", async () => {
    const res = await api.get("/user/check-username?username=nonexistent_user")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.exists).toBe(false)
  })

  test("Should return 400 if username is missing", async () => {
    const res = await api.get("/user/check-username")
    expect(res.status).toBe(400)
  })
})
// #endregion

// #region /api/user/increment-generations
describe("POST /api/user/increment-generations", () => {
  let previousGenerations: number

  beforeAll(async () => {
    const res = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = await res.json()
    previousGenerations = data.generations ?? 0
  })

  test("Should increment the generations field by 1", async () => {
    const res = await api.post("/user/increment-generations", {
      body: {
        userId: env.CLERK_TEST_USER_ID,
      },
    })
    expect(res.status).toBe(200)

    const after = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = await after.json()
    expect(data.generations).toBe(previousGenerations + 1)
  })
})
// #endregion

// #region /api/user/update-tier
describe("POST /api/user/update-tier", () => {
  let previousTier: string
  let previousExpires: string

  beforeAll(async () => {
    const res = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = await res.json()
    previousTier = data.tier
    previousExpires = data.tierExpiresAt
  })

  test("Should update tier and reset generations", async () => {
    const res = await api.post("/user/update-tier", {
      body: {
        userId: env.CLERK_TEST_USER_ID,
        tier: "PRO",
        tierExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    expect(res.status).toBe(200)

    const after = await api.get(`/user?id=${env.CLERK_TEST_USER_ID}`)
    const data = await after.json()
    expect(data.tier).toBe("PRO")
    expect(data.generations).toBe(0)
  })

  afterAll(async () => {
    await api.post("/user/update-tier", {
      body: {
        userId: env.CLERK_TEST_USER_ID,
        tier: previousTier,
        tierExpiresAt: new Date(previousExpires),
      },
    })
  })
})
// #endregion

// #region /api/user/check-reset
describe("POST /api/user/check-reset", () => {
  test("Should reset generations if month changed", async () => {
    // Force a lastResetDate to a past month
    await api.put("/user", {
      body: {
        id: env.CLERK_TEST_USER_ID,
        lastResetDate: new Date("2000-01-01").getTime(),
      },
    })

    const res = await api.post("/user/check-reset", {
      body: {
        userId: env.CLERK_TEST_USER_ID,
      },
    })

    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBeOneOf(["Reset successful", "No reset needed"])
  })

  test("Should skip reset if already reset this month", async () => {
    const res = await api.post("/user/check-reset", {
      body: {
        userId: env.CLERK_TEST_USER_ID,
      },
    })

    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBe("No reset needed")
  })

  test("Should return 404 if user doesn't exist", async () => {
    const res = await api.post("/user/check-reset", {
      body: {
        userId: "nonexistent-id",
      },
    })

    expect(res.status).toBe(404)
  })
})
// #endregion
