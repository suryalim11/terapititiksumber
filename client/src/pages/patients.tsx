import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAge } from "@/lib/utils";
import { Search, Plus, UserRound } from "lucide-react";

interface Patient {
  id: number;
  patientId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  birthDate: string;
  address?: string;
  gender: string;
  medicalHistory?: string;
  createdAt: string;
}

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch patients data
  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });
  
  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phoneNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patients</h2>
          <p className="text-muted-foreground">
            Manage your patient records and medical history.
          </p>
        </div>
        <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Patient
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search patients by name, ID, or phone number..."
          className="w-full rounded-md border border-input bg-background pl-8 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Patients List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/40 p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-4 w-4 text-primary" />
                  </span>
                  {patient.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Patient ID</div>
                  <div className="font-medium">{patient.patientId}</div>
                  
                  <div className="text-muted-foreground">Phone</div>
                  <div className="font-medium">{patient.phoneNumber}</div>
                  
                  <div className="text-muted-foreground">Age</div>
                  <div className="font-medium">{calculateAge(patient.birthDate)} years</div>
                  
                  <div className="text-muted-foreground">Gender</div>
                  <div className="font-medium">{patient.gender === 'M' ? 'Male' : 'Female'}</div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <button className="inline-flex flex-1 items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    View Details
                  </button>
                  <button className="inline-flex flex-1 items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    Edit Patient
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No patients found</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {searchTerm ? "No patients match your search criteria. Try a different search term." : "You haven't added any patients yet. Click 'Add Patient' to get started."}
          </p>
        </div>
      )}
    </div>
  );
}