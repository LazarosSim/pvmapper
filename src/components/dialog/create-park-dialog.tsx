import React from 'react';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel} from '@/components/ui/form';
import {useForm} from 'react-hook-form';
import * as z from 'zod';
import {zodResolver} from "@hookform/resolvers/zod";
import {useAddPark} from "@/hooks/parks";
import {useCurrentUser} from "@/hooks/use-user.tsx";

interface CreateParkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  name: z.string().min(1, "Park name is required"),
  expectedBarcodes: z.coerce.number().int().nonnegative("Must be a positive number")
});

const CreateParkDialog: React.FC<CreateParkDialogProps> = ({ open, onOpenChange }) => {
  const {mutateAsync: addPark} = useAddPark();
  const {data: currentUser} = useCurrentUser();


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      expectedBarcodes: 0
    }
  });
  
  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('create-park-dialog: handleSubmit', values);
    const result = await addPark({
      name: values.name,
      expectedBarcodes: values.expectedBarcodes,
      userId: currentUser.id,
      validateBarcodeLength: true,
    });
    if (result) {
      form.reset();
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Park</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Park Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter park name" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expectedBarcodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Barcodes</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormDescription>
                    The total number of barcodes expected for this park.
                  </FormDescription>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Park
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateParkDialog;
