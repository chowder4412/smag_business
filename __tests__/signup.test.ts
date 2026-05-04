// Signup validation logic extracted for testing
// These mirror the validation in app/(auth)/login.tsx

function validateDriverForm(form: {
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
}): string | null {
  if (!form.name.trim() || !form.email.trim() || !form.phone.trim() ||
      !form.vehicleType.trim() || !form.vehiclePlate.trim()) {
    return "All fields except license number are required.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return "Enter a valid email address.";
  }
  return null;
}

function validateKitchenForm(form: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  cuisine: string;
}): string | null {
  if (!form.businessName.trim() || !form.ownerName.trim() || !form.email.trim() ||
      !form.phone.trim() || !form.address.trim() || !form.cuisine.trim()) {
    return "Business name, owner name, email, phone, address, and cuisine are required.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return "Enter a valid email address.";
  }
  return null;
}

describe("Driver registration validation", () => {
  const valid = {
    name: "John Doe",
    email: "john@example.com",
    phone: "+234 801 234 5678",
    vehicleType: "Motorcycle",
    vehiclePlate: "ABC-123-XY"
  };

  it("passes with all valid fields", () => {
    expect(validateDriverForm(valid)).toBeNull();
  });

  it("fails when name is empty", () => {
    expect(validateDriverForm({ ...valid, name: "" })).not.toBeNull();
  });

  it("fails when email is invalid", () => {
    expect(validateDriverForm({ ...valid, email: "notanemail" })).toBe("Enter a valid email address.");
  });

  it("fails when phone is empty", () => {
    expect(validateDriverForm({ ...valid, phone: "" })).not.toBeNull();
  });

  it("fails when vehicleType is empty", () => {
    expect(validateDriverForm({ ...valid, vehicleType: "" })).not.toBeNull();
  });

  it("fails when vehiclePlate is empty", () => {
    expect(validateDriverForm({ ...valid, vehiclePlate: "" })).not.toBeNull();
  });
});

describe("Kitchen registration validation", () => {
  const valid = {
    businessName: "The Gourmet Kitchen",
    ownerName: "Jane Smith",
    email: "jane@kitchen.com",
    phone: "+234 801 234 5678",
    address: "123 Main Street, Lagos",
    cuisine: "Nigerian"
  };

  it("passes with all valid fields", () => {
    expect(validateKitchenForm(valid)).toBeNull();
  });

  it("fails when businessName is empty", () => {
    expect(validateKitchenForm({ ...valid, businessName: "" })).not.toBeNull();
  });

  it("fails when email is invalid", () => {
    expect(validateKitchenForm({ ...valid, email: "bad-email" })).toBe("Enter a valid email address.");
  });

  it("fails when cuisine is empty", () => {
    expect(validateKitchenForm({ ...valid, cuisine: "" })).not.toBeNull();
  });

  it("fails when address is empty", () => {
    expect(validateKitchenForm({ ...valid, address: "" })).not.toBeNull();
  });

  it("accepts email with subdomain", () => {
    expect(validateKitchenForm({ ...valid, email: "owner@mail.kitchen.com" })).toBeNull();
  });
});
