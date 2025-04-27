import { useState } from "react";
import Input from "../../ui/AuthenticationInput";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import AddressInput from "./AddressInput";
import FileInput from "../../ui/FileInput";
import { useForm } from "react-hook-form";
import Button from "../../ui/Button";
import { useCreatePost } from "./useCreatePost";
import { useUser } from "../authentication/useUser";

const CreatePostForm = () => {
  const { user } = useUser();
  // 추후에 authenticated 유저만 추가하도록 변경
  const [address, setAddress] = useState("");

  const { register, handleSubmit } = useForm();
  const { createProductPost } = useCreatePost();
  function onSubmit(data) {
    console.log(data);
    createProductPost({
      ...data,
      category: "가전",
      image: data.image,
      address,
      sellerNickname: user?.user_metadata.nickname,
    });
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label='제목' htmlFor='postTitle'>
        <Input type='text' id='postTitle' {...register("postTitle")} />
      </FormRow>

      <FormRow label='내용' htmlFor='description'>
        <Input type='text' id='description' {...register("description")} />
      </FormRow>

      <FormRow label='물건이름' htmlFor='productName'>
        <Input type='text' id='productName' {...register("productName")} />
      </FormRow>

      <FormRow label='가격' htmlFor='price'>
        <Input type='number' id='price' {...register("price")} />
      </FormRow>

      <FormRow label='이미지'>
        <FileInput id='image' accept='image/*' {...register("image")} />
      </FormRow>

      <AddressInput setAddress={setAddress} />

      <FormRow>
        <Button>글 올리기</Button>
      </FormRow>
    </Form>
  );
};

export default CreatePostForm;
