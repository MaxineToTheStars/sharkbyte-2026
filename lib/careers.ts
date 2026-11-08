export type CareerId =
  | "cybersecurity"
  | "culinary"
  | "architecture"
  | "mechanical"
  | "it";

export type Program = {
  id: string;
  label: string;
  catalogTitle: string;
  sentinel: string | null;
  pdfUrl: string;
  pageHint?: number;
  note?: string;
};

export type Career = {
  id: CareerId;
  label: string;
  programs: Program[];
};

export const lineColor: Record<CareerId, string> = {
  architecture: "#E8B400",
  mechanical: "#3A5BA0",
  culinary: "#C8412E",
  cybersecurity: "#0E8C8A",
  it: "#7A8F3A",
};

export const careers: Career[] = [
  {
    id: "cybersecurity",
    label: "Cybersecurity specialist",
    programs: [
      {
        id: "cyber-as",
        label: "Associate in Science",
        catalogTitle: "Associate in Science in Cybersecurity",
        sentinel: "CTS 1134",
        pageHint: 9319,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AS_Cybersecurity_csg.pdf",
      },
      {
        id: "cyber-bs",
        label: "Bachelor of Science",
        catalogTitle: "Bachelor of Science in Cybersecurity",
        sentinel: "CIS 3215",
        pageHint: 9151,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/BS_Cybersecurity_csg.pdf",
      },
    ],
  },
  {
    id: "culinary",
    label: "Chef",
    programs: [
      {
        id: "culinary-as",
        label: "Associate in Science",
        catalogTitle: "Associate in Science in Culinary Arts Management",
        sentinel: "FSS 1200",
        pageHint: 9318,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AS_CulinaryArtsManagement_csg.pdf",
      },
    ],
  },
  {
    id: "architecture",
    label: "Architect",
    programs: [
      {
        id: "arch-aa",
        label: "Associate in Arts",
        catalogTitle: "Associate in Arts in Architecture",
        sentinel: "ARC 1115",
        pageHint: 9375,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/2025/AA_Architecture_csg.pdf",
      },
      {
        id: "arch-as",
        label: "Architectural Design and Construction Technology",
        catalogTitle:
          "Associate in Science in Architectural Design and Construction Technology",
        sentinel: null,
        pageHint: 9300,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AS_ArchitecturalDesign%26ConstructionTechnology_csg.pdf",
      },
    ],
  },
  {
    id: "mechanical",
    label: "Mechanical engineer",
    programs: [
      {
        id: "mech-aa",
        label: "Associate in Arts",
        catalogTitle: "Associate in Arts in Engineering - Mechanical",
        sentinel: "EGN 1008C",
        pageHint: 9398,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AA_Engineering-Mechanical_csg.pdf",
        note: "This is the transfer path toward a bachelor's and the FE exam.",
      },
    ],
  },
  {
    id: "it",
    label: "IT consultant",
    programs: [
      {
        id: "it-as",
        label: "Associate in Science",
        catalogTitle: "Associate in Science in Computer Information Technology",
        sentinel: "CTS 1134",
        pageHint: 9311,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AS_ComputerInformationTechnology_csg.pdf",
      },
      {
        id: "it-aa",
        label: "Associate in Arts",
        catalogTitle: "Associate in Arts in Computer Information Systems",
        sentinel: "CGS 1060C",
        pageHint: 9383,
        pdfUrl:
          "https://www.mdc.edu/academics/programs/csg/AA_ComputerInformationSystems_csg.pdf",
      },
    ],
  },
];

export function getCareer(id: string): Career | undefined {
  return careers.find((career) => career.id === id);
}

export function getProgram(
  careerId: string,
  programId: string,
): Program | undefined {
  return getCareer(careerId)?.programs.find((program) => program.id === programId);
}
