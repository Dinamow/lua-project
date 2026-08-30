// Fallback employee directory for when BambooHR isn't connected, and the seed data for the
// Iqama expiry job (trial BambooHR companies don't have that field configured).

export interface MockEmployee {
  id: string;
  firstName: string;
  lastName: string;
  country: "KSA" | "UAE" | "EGYPT" | "JORDAN";
  department: string;
  hireDate: string; // ISO date
  monthlyBasicSalary: number;
  phoneNumber: string; // E.164, used for WhatsApp/SMS outbound
  email: string;
  supervisorId: string;
  iqamaExpiry?: string; // ISO date, KSA employees only
}

export const mockEmployees: MockEmployee[] = [
  {
    id: "emp_1001",
    firstName: "Ahmad",
    lastName: "Al-Otaibi",
    country: "KSA",
    department: "Operations",
    hireDate: "2019-03-01",
    monthlyBasicSalary: 9000,
    phoneNumber: "+966500000001",
    email: "ahmad.alotaibi@example.com",
    supervisorId: "emp_2001",
    iqamaExpiry: daysFromNow(12),
  },
  {
    id: "emp_1002",
    firstName: "Sara",
    lastName: "Al-Harbi",
    country: "KSA",
    department: "Operations",
    hireDate: "2023-06-15",
    monthlyBasicSalary: 6500,
    phoneNumber: "+966500000002",
    email: "sara.alharbi@example.com",
    supervisorId: "emp_2001",
    iqamaExpiry: daysFromNow(45),
  },
  {
    id: "emp_1003",
    firstName: "Mohammed",
    lastName: "Rashed",
    country: "UAE",
    department: "Logistics",
    hireDate: "2021-01-10",
    monthlyBasicSalary: 12000,
    phoneNumber: "+971500000003",
    email: "mohammed.rashed@example.com",
    supervisorId: "emp_2002",
  },
  {
    id: "emp_1004",
    firstName: "Fatima",
    lastName: "El-Sayed",
    country: "EGYPT",
    department: "Finance",
    hireDate: "2014-09-01",
    monthlyBasicSalary: 18000,
    phoneNumber: "+201000000004",
    email: "fatima.elsayed@example.com",
    supervisorId: "emp_2003",
  },
  {
    id: "emp_1005",
    firstName: "Khaled",
    lastName: "Nasser",
    country: "JORDAN",
    department: "Finance",
    hireDate: "2020-02-20",
    monthlyBasicSalary: 850,
    phoneNumber: "+962700000005",
    email: "khaled.nasser@example.com",
    supervisorId: "emp_2003",
  },
  {
    id: "emp_2001",
    firstName: "Noura",
    lastName: "Al-Dosari",
    country: "KSA",
    department: "Operations",
    hireDate: "2016-05-01",
    monthlyBasicSalary: 16000,
    phoneNumber: "+966500000006",
    email: "noura.aldosari@example.com",
    supervisorId: "emp_2001", // top of the mock org chart, self-referential
    iqamaExpiry: daysFromNow(6),
  },
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function findEmployee(idOrEmail: string): MockEmployee | undefined {
  return mockEmployees.find(
    (e) =>
      e.id === idOrEmail || e.email.toLowerCase() === idOrEmail.toLowerCase(),
  );
}
