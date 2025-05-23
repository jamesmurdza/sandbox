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

const BEFORE_ALL_TIMEOUT = 30000 // 30 sec

const PROJECT_TEMPLATES = ["reactjs", "vanillajs", "nextjs", "streamlit", "php"]
let noOfSandboxes = 0
describe("GET /api/sandbox", () => {
  let mainResponse: Response
  let mainBody: Array<{ [key: string]: unknown }>

  beforeAll(async () => {
    mainResponse = await api.get("/sandbox")
    mainBody = await mainResponse.json()
  }, BEFORE_ALL_TIMEOUT)

  test("Should have response status 200", () => {
    expect(mainResponse.status).toBe(200)
  })

  test("Should have array in the body", async () => {
    expectTypeOf(mainBody).toBeArray()
    noOfSandboxes = mainBody.length
  })

  test("Should have array of objects in the body", async () => {
    expect(mainBody[0]).toBeInstanceOf(Object)
  })
  test("With query params", async () => {
    const firstItem = mainBody[0]
    const response = await api.get(`/sandbox?id=${firstItem.id}`)
    const body = await response.json()
    expect(body).toBeInstanceOf(Object)
  })
})

let createdSandboxId: string
describe("PUT /api/sandbox", () => {
  test("Should create a sandbox", async () => {
    const response = await api.put("/sandbox", {
      body: {
        name: "Vitest Sandbox",
        userId: env.CLERK_TEST_USER_ID,
        type: PROJECT_TEMPLATES[0],
        visibility: "private",
      },
    })

    expect(response.status).toBe(200)
    const id = await response.text()
    console.log("Created sandbox ID:", id)
    createdSandboxId = id as string
  })
})

describe("POST /api/sandbox", () => {
  test("Should update sandbox by ID", async () => {
    const response = await api.post(`/sandbox`, {
      body: {
        id: createdSandboxId,
        name: "Updated Vitest Sandbox",
        visibility: "public",
      },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Success")
  })
})

describe("POST /api/sandbox/like", () => {
  test("Should return 400 for missing fields", async () => {
    const response = await api.post("/sandbox/like", {
      body: { sandboxId: createdSandboxId },
    })
    expect(response.status).toBe(400)
  })

  test("Should like and unlike sandbox", async () => {
    // Like
    const likeResponse = await api.post("/sandbox/like", {
      body: { sandboxId: createdSandboxId, userId: env.CLERK_TEST_USER_ID },
    })
    expect(likeResponse.status).toBe(200)
    const likeBody = await likeResponse.json()
    expect(likeBody.liked).toBe(true)

    // Unlike
    const unlikeResponse = await api.post("/sandbox/like", {
      body: { sandboxId: createdSandboxId, userId: env.CLERK_TEST_USER_ID },
    })
    expect(unlikeResponse.status).toBe(200)
    const unlikeBody = await unlikeResponse.json()
    expect(unlikeBody.liked).toBe(false)
  })
})

describe("GET /api/sandbox/like", () => {
  let createdSandboxId: string

  beforeAll(async () => {
    const response = await api.get("/sandbox")
    const sandboxes = await response.json()
    createdSandboxId = sandboxes[0]?.id
  }, BEFORE_ALL_TIMEOUT)

  test("Should return 400 for missing params", async () => {
    const response = await api.get("/sandbox/like?sandboxId=test")
    expect(response.status).toBe(400)
  })

  test("Should return like status", async () => {
    const response = await api.get(
      `/sandbox/like?sandboxId=${createdSandboxId}&userId=${env.CLERK_TEST_USER_ID}`
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("liked")
    expectTypeOf(body.liked).toBeBoolean
  })
})

describe("DELETE /api/sandbox?id=xxx", () => {
  test("Should delete a sandbox", async () => {
    const response = await api.delete(`/sandbox?id=${createdSandboxId}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Success")
  })
})

const SANDBOX_LIMIT = 8
describe("POST /api/sandbox (limit enforcement)", () => {
  const sandboxIds: string[] = []

  beforeAll(async () => {
    const sandboxesToCreate = SANDBOX_LIMIT - noOfSandboxes
    for (let i = 0; i < sandboxesToCreate; i++) {
      const res = await api.put("/sandbox", {
        body: {
          name: `Box ${i}`,
          userId: env.CLERK_TEST_USER_ID,
          type: PROJECT_TEMPLATES[i % PROJECT_TEMPLATES.length],
          visibility: "private",
        },
      })
      const id = await res.text()
      sandboxIds.push(id)
    }
  }, BEFORE_ALL_TIMEOUT)

  test("Should reject sandbox creation beyond limit", async () => {
    const response = await api.put("/sandbox", {
      body: {
        name: "Overflow Box",
        userId: env.CLERK_TEST_USER_ID,
        type: PROJECT_TEMPLATES[0],
        visibility: "private",
      },
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
    const body = await response.text()
    expect(body).toMatch(/maximum/i)
  })

  afterAll(async () => {
    await Promise.all(sandboxIds.map((id) => api.delete(`/sandbox?id=${id}`)))
  })
})
