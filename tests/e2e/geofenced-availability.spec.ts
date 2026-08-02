import { expect, test } from "@playwright/test";

const mockBase = "/api/mock/v1/customer";

test("location changes slot capacity and another zone cannot supply the booking", async ({ request }) => {
  const date = new Date(Date.now() + (21 * 24 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10);
  const availabilityUrl = (latitude: number, longitude: number) =>
    `${mockBase}/availability?date=${date}&cars[0][service_id]=1&latitude=${latitude}&longitude=${longitude}`;

  const westBeforeResponse = await request.get(availabilityUrl(25.30, 51.40));
  expect(westBeforeResponse.ok()).toBeTruthy();
  const westBefore = (await westBeforeResponse.json()).data;
  const target = westBefore.slots.find((slot: { start: string }) => slot.start === "10:00");
  expect(target.available).toBeTruthy();

  const phone = `+97455${Date.now().toString().slice(-6)}`;
  await request.post(`${mockBase}/auth/request-otp`, {
    data: { phone, purpose: "registration" },
  });
  const registerResponse = await request.post(`${mockBase}/auth/register`, {
    data: {
      phone,
      code: "123456",
      name: "Zone capacity test",
      password: "SafePassword123!",
    },
  });
  expect(registerResponse.status()).toBe(201);
  const token = (await registerResponse.json()).data.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  const vehicleResponse = await request.post(`${mockBase}/vehicles`, {
    headers: auth,
    data: {
      type: "sedan",
      plate_number: `Z${Date.now().toString().slice(-6)}`,
      make: "Test",
      model: "Zone",
    },
  });
  expect(vehicleResponse.status()).toBe(201);
  const vehicleId = (await vehicleResponse.json()).data.id as number;

  const bookingResponse = await request.post(`${mockBase}/bookings`, {
    headers: auth,
    data: {
      scheduled_at: `${date}T10:00:00+03:00`,
      cars: [{ vehicle_id: vehicleId, service_id: 1, add_on_ids: [] }],
      address_area: "West test zone",
      building_number: "1",
      latitude: 25.30,
      longitude: 51.40,
      service_area_version: westBefore.service_area.version,
      dispatch_zone_version: westBefore.dispatch_zone.version,
      duration_version: westBefore.duration.version,
      payment_method: "online",
    },
  });
  expect(bookingResponse.status()).toBe(201);

  const [westAfterResponse, eastAfterResponse] = await Promise.all([
    request.get(availabilityUrl(25.30, 51.40)),
    request.get(availabilityUrl(25.30, 51.50)),
  ]);
  const westAfter = (await westAfterResponse.json()).data;
  const eastAfter = (await eastAfterResponse.json()).data;
  const westTarget = westAfter.slots.find((slot: { start: string }) => slot.start === "10:00");
  const eastTarget = eastAfter.slots.find((slot: { start: string }) => slot.start === "10:00");

  expect(westAfter.dispatch_zone.version).not.toBe(eastAfter.dispatch_zone.version);
  expect(westTarget.available).toBeFalsy();
  expect(eastTarget.available).toBeTruthy();
});
