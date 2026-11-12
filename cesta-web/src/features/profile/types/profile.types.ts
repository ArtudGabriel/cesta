export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  locale: "es" | "pt-BR";
  roles: string[];
  prefersVegan: boolean;
  prefersVegetarian: boolean;
  prefersGlutenFree: boolean;
  prefersLactoseFree: boolean;
  createdAt: string;
}

export interface UpdateProfilePayload {
  name?: string;
  locale?: "es" | "pt-BR";
  prefersVegan?: boolean;
  prefersVegetarian?: boolean;
  prefersGlutenFree?: boolean;
  prefersLactoseFree?: boolean;
}
