import { useState } from "react";
import Input from "../../ui/AuthenticationInput";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import AddressInput from "./AddressInput";
import FileInput from "../../ui/FileInput";

const CreatePostForm = () => {
  const [address, setAddress] = useState("");

  console.log(address);
  return (
    <Form>
      <FormRow label='제목' htmlFor='title'>
        <Input type='text' id='title' />
      </FormRow>
      <FormRow label='내용' htmlFor='description'>
        <Input type='text' id='description' />
      </FormRow>
      <FormRow label='가격' htmlFor='price'>
        <Input type='number' id='price' />
      </FormRow>
      <FormRow label='이미지'>
        <FileInput id='image' accept='image/*' />
      </FormRow>
      <AddressInput setAddress={setAddress} />
    </Form>
  );
};

export default CreatePostForm;
