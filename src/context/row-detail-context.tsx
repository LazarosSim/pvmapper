import {supabase} from "@/lib/supabase/client.ts";
import React from "react";
import {useMutation, useQuery, useQueryClient, UseQueryResult} from "@tanstack/react-query";

type RowDetails = Awaited<ReturnType<typeof fetchRowDetails>>;

export const fetchRowDetails = async (rowId: string) => {
    const { data: rowDetails, error } =  await supabase
        .from("rows")
        .select("id, name, park:parks(id, name), barcodes(id, code, displayOrder:display_order)")
        .eq("id", rowId)
        .single();

    if (error) {
        console.error("SB ERROR: ", error);
        throw error;
    }

    return rowDetails;
};

export const resetRowBarcodes = async (rowId: string) => {
    await supabase.from("barcodes").delete().eq("row_id", rowId)
}

type RowDetailActions = {
    resetRow: (rowId: string) => void
    renameRow: (rowId: string, name: string) => void;
    addBarcode: (rowId: string, barcode: {code: string, displayOrder: number}) => void;
}

type RowDetailState = {
    rowDetailsQuery: UseQueryResult<RowDetails>;
    actions: RowDetailActions;
};

const RowDetailContext = React.createContext<RowDetailState | null>(null);

export const RowDetailProvider = ({ rowId, children }: { rowId: string, children: React.ReactNode }) => {
    const qc = useQueryClient();

    const rowDetailsQuery = useQuery({
        queryKey: ["row-details", rowId],
        queryFn: () => fetchRowDetails(rowId),
    })

    const resetMutation = useMutation({
      mutationFn: () => resetRowBarcodes(rowId),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["row-details", rowId] })
      }
    });

    const actions = {
        resetRow: () => resetMutation.mutate(),
        // TODO: implement mutations
        renameRow: (rowId: string, name: string) => {},
        addBarcode: (rowId: string, barcode: {code: string, displayOrder: number}) => {}
    }

    return (
        <RowDetailContext.Provider value={{rowDetailsQuery, actions}}>
            {children}
        </RowDetailContext.Provider>
    )
}

export const useRowDetailQuery = () => {
    const context = React.useContext(RowDetailContext);
    if (context === null) {
        throw new Error("useRowDetail must be used within a RowDetailProvider");
    }

    return context.rowDetailsQuery;
}

export const useRowDetailActions = () => {
    const context = React.useContext(RowDetailContext);
    if (context === null) {
        throw new Error("useRowDetail must be used within a RowDetailProvider");
    }

    return context.actions;
}


