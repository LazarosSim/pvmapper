import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table.tsx";
import React, {useState} from "react";
import {Input} from "@/components/ui/input.tsx";
import {Button} from "@/components/ui/button.tsx";
import {ArrowDown, Check, Edit, X} from "lucide-react";
import {useRowBarcodes} from "@/hooks/use-barcodes-queries.tsx";
import {Barcode} from "@/lib/types/db-types.ts";
import {toast} from "sonner";
import {useDB} from "@/lib/db-provider.tsx";

type Props = {
    rowId: string,
    searchQuery?: string
    setIsInsertDialogOpen: (value: boolean) => void;
}

const BarcodeTable = ({rowId, searchQuery, setIsInsertDialogOpen}: Props) => {
    const [editingBarcode, setEditingBarcode] = useState<{id: string, code: string} | null>(null);
    const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
    const { resetRow, updateRow, updateBarcode, addBarcode } = useDB();


    const {data: barcodes, isLoading, isError, error} = useRowBarcodes(rowId, { code: searchQuery });

    const handleSaveEditedBarcode = async () => {
        if(!editingBarcode) return;

        await updateBarcode(
            editingBarcode.id,
            editingBarcode.code);

        toggleEditingBarcode(null);
    }


    const toggleEditingBarcode = (barcode: Barcode) => {
        return barcode ? setEditingBarcode({id: barcode.id, code: barcode.code}) : setEditingBarcode(null);
    }



    if (!barcodes || barcodes.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                    {searchQuery ? "No barcodes found matching your search" : "No barcodes found. Add your first barcode to get started."}
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-md border glass-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-20">No.</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead className="w-40">Timestamp</TableHead>
                        <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {barcodes.map((barcode, index) => (
                        <TableRow key={barcode.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                                {editingBarcode && editingBarcode.id === barcode.id ? (
                                    <div className="flex items-center space-x-2">
                                        <Input
                                            value={editingBarcode.code}
                                            onChange={(e) => setEditingBarcode({
                                                ...editingBarcode,
                                                code: e.target.value
                                            })}
                                            className="w-full"
                                            autoFocus
                                        />
                                        <Button variant="ghost" size="icon" onClick={handleSaveEditedBarcode}
                                                className="text-inventory-secondary">
                                            <Check className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => toggleEditingBarcode(null)}
                                                className="text-red-500">
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ) : (
                                    barcode.code
                                )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {new Date(barcode.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center space-x-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleEditingBarcode(barcode)}
                                        className="h-8 w-8 text-inventory-secondary"
                                    >
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setInsertAfterIndex(index);
                                            setIsInsertDialogOpen(true);
                                        }}
                                        className="h-8 w-8 text-inventory-primary"
                                    >
                                        <ArrowDown className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}


export default BarcodeTable;